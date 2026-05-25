const { Client, Events, GatewayIntentBits, SlashCommandBuilder, VoiceConnection } = require("@wecordy/core")
const Database = require("better-sqlite3")
const db = new Database("./database.sqlite")
const TOKEN  = ""
const AI_KEY = "ANTHROPIC_API_KEY_BURAYA"
const ADMIN_PERM = "8"
const ADMINS = new Set()

const client = new Client({
  intents: [
    GatewayIntentBits.Servers,
    GatewayIntentBits.ServerMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.ServerVoiceStates
  ]
})

const balances      = {}
const levels        = {}
const cooldowns     = {}
const duelRequests  = {}
const inventories   = {}
const marryRequests = {}
const married       = {}
const warnings      = {}
const banned        = new Set()
const stats         = {}
const usernames     = {}
const aiHistory     = {}
const voiceQueues   = {}
const voiceConns    = {}
const announcements = []

const shopItems = [
  { id: "kalkan", name: "🛡️ Kalkan",       price: 500,   desc: "Düelloda hasar azaltır"        },
  { id: "bilek",  name: "⚔️ Bilek Zırhı",  price: 750,   desc: "Düelloda kazanma şansı artar"  },
  { id: "sans",   name: "🍀 Şans Muskası",  price: 300,   desc: "Slotta bonus şans"              },
  { id: "kasa",   name: "🏦 Kasa",          price: 2000,  desc: "Günlük ödülü 2 katına çıkarır" },
  { id: "elmas",  name: "💎 Elmas",         price: 5000,  desc: "Prestij eşyası"                 },
  { id: "hiz",    name: "⚡ Hız Botu",      price: 3000,  desc: "Çalış cooldown'ı 15sn'ye iner" },
  { id: "lotar",  name: "🎰 Lotarya Bileti",price: 100,   desc: "Günlük çekilişe katılım hakkı" }
]

const levelRoles = {
  5:  "🌱 Çaylak",
  10: "⚡ Aktif",
  15: "🔥 Pro",
  20: "👑 Efsane",
  30: "💎 Elmas",
  50: "🌌 Ölümsüz"
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function initUser(userId, username) {
  if (username) usernames[userId] = username
  if (!balances[userId])    balances[userId]    = 1000
  if (!levels[userId])      levels[userId]      = { xp: 0, level: 1, role: "🌱 Yeni" }
  if (!inventories[userId]) inventories[userId] = []
  if (!stats[userId])       stats[userId]       = { wins: 0, losses: 0, totalEarned: 0, totalLost: 0, gamesPlayed: 0 }
  if (!aiHistory[userId])   aiHistory[userId]   = []
}

function getName(userId) {
  return usernames[userId] || ("Kullanıcı#" + String(userId).slice(-4))
}

function addMoney(userId, amount) {
  initUser(userId)
  balances[userId] += amount
  stats[userId].totalEarned += amount
}

function removeMoney(userId, amount) {
  initUser(userId)
  if (balances[userId] < amount) return false
  balances[userId] -= amount
  stats[userId].totalLost += amount
  return true
}

function checkCooldown(userId, cmd, ms) {
  if (!cooldowns[userId]) cooldowns[userId] = {}
  var now     = Date.now()
  var expires = cooldowns[userId][cmd]
  if (expires && now < expires) return expires - now
  cooldowns[userId][cmd] = now + ms
  return 0
}

function formatMs(ms) {
  var secs = Math.ceil(ms / 1000)
  if (secs < 60) return secs + " saniye"
  var mins = Math.floor(secs / 60), rem = secs % 60
  if (mins < 60) return rem > 0 ? mins + "dk " + rem + "sn" : mins + " dakika"
  var hrs = Math.floor(mins / 60), remM = mins % 60
  return remM > 0 ? hrs + "sa " + remM + "dk" : hrs + " saat"
}

function progressBar(current, max) {
  var len    = 12
  var filled = Math.round(Math.min(current / max, 1) * len)
  return "▓".repeat(filled) + "░".repeat(len - filled)
}

function isAdmin(userId) { return ADMINS.has(userId) }

function hasItem(userId, itemId) {
  initUser(userId)
  return inventories[userId].includes(itemId)
}

function fmt(n) { return Number(n).toLocaleString("tr-TR") }

function getStr(interaction, name) {
  var val = interaction.getString(name)
  return val || null
}

function getInt(interaction, name) {
  var val = interaction.getInteger(name)
  return (val !== null && val !== undefined) ? val : null
}

function resolveTargetId(interaction, name) {
  var raw = getStr(interaction, name)
  if (!raw) return null
  return raw.replace(/[<@!>]/g, "").trim()
}

async function askAI(userId, userMsg) {
  if (!aiHistory[userId]) aiHistory[userId] = []
  aiHistory[userId].push({ role: "user", content: userMsg })
  if (aiHistory[userId].length > 20) aiHistory[userId] = aiHistory[userId].slice(-20)

  var https = require("https")
  var body  = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: "Sen Wecordy platformunda çalışan eğlenceli bir bot asistanısın. Kullanıcılara samimi ve kısa Türkçe yanıtlar ver. Gerektiğinde bot komutları hakkında bilgi de verebilirsin.",
    messages: aiHistory[userId]
  })

  return new Promise(function(resolve) {
    var opts = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AI_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    }
    var req = https.request(opts, function(res) {
      var data = ""
      res.on("data", function(c) { data += c })
      res.on("end", function() {
        try {
          var parsed = JSON.parse(data)
          var reply  = parsed.content && parsed.content[0] ? parsed.content[0].text : "Bir hata oluştu."
          aiHistory[userId].push({ role: "assistant", content: reply })
          resolve(reply)
        } catch(e) { resolve("AI yanıt veremedi.") }
      })
    })
    req.on("error", function(e) { resolve("AI ulaşılamıyor: " + e.message) })
    req.write(body)
    req.end()
  })
}

async function playNextInQueue(serverId) {
  var queue = voiceQueues[serverId]
  if (!queue || queue.items.length === 0) {
    queue.playing = false
    return
  }

  var conn = voiceConns[serverId]
  if (!conn) {
    queue.playing = false
    return
  }

  queue.playing = true
  var item = queue.items[0]

  try {
    var player = conn.playUrl(item.url)
    queue.currentPlayer = player

    player.on && player.on("end", function() {
      queue.items.shift()
      queue.history = queue.history || []
      queue.history.push(item)
      if (queue.history.length > 10) queue.history.shift()
      playNextInQueue(serverId)
    })
  } catch(e) {
    console.error("[MÜZİK HATA]", e.message)
    queue.items.shift()
    queue.playing = false
  }
}

function buildCommands() {
  var c = []

  c.push(new SlashCommandBuilder().setName("ping").setDescription("🏓 Botun aktif olduğunu kontrol et").toJSON())

  c.push(new SlashCommandBuilder().setName("profil").setDescription("👤 Profil bilgilerini görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı (boş = kendin)") })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("rank").setDescription("📈 Seviye ve XP bilgini görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı") })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("stats").setDescription("📊 Oyun istatistiklerini görüntüle").toJSON())

  c.push(new SlashCommandBuilder().setName("siralama").setDescription("🏆 Sunucu sıralamasını görüntüle")
    .addStringOption(function(o) {
      return o.setName("tur").setDescription("Sıralama türü")
        .addChoices({ name: "💰 Para", value: "para" }, { name: "⭐ Seviye", value: "xp" })
    })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("balans").setDescription("💰 Mevcut bakiyeni görüntüle").toJSON())

  c.push(new SlashCommandBuilder().setName("calis").setDescription("💼 Çalışarak para kazan (30sn bekleme)").toJSON())

  c.push(new SlashCommandBuilder().setName("gunluk").setDescription("🎁 Günlük ödülünü al (24sa)").toJSON())

  c.push(new SlashCommandBuilder().setName("haftalik").setDescription("🎊 Haftalık büyük ödülünü al (7 gün)").toJSON())

  c.push(new SlashCommandBuilder().setName("faiz").setDescription("🏦 Bakiyene günlük %5 faiz al (24sa)").toJSON())

  c.push(new SlashCommandBuilder().setName("transfer").setDescription("💸 Başka bir kullanıcıya para gönder")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Miktar").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("soygun").setDescription("🦹 Başka birini soygunlamayı dene (%45 başarı)")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("kumar").setDescription("🎲 %40 şansla 2 katı kazan")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis miktarı").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("magaza").setDescription("🛒 Bot mağazasını görüntüle").toJSON())

  c.push(new SlashCommandBuilder().setName("satin").setDescription("🛒 Mağazadan eşya satın al")
    .addStringOption(function(o) {
      return o.setName("esya").setDescription("Satın alınacak eşya").setRequired(true)
        .addChoices(
          { name: "🛡️ Kalkan — 500 💵",        value: "kalkan" },
          { name: "⚔️ Bilek Zırhı — 750 💵",   value: "bilek"  },
          { name: "🍀 Şans Muskası — 300 💵",   value: "sans"   },
          { name: "🏦 Kasa — 2000 💵",          value: "kasa"   },
          { name: "💎 Elmas — 5000 💵",         value: "elmas"  },
          { name: "⚡ Hız Botu — 3000 💵",      value: "hiz"    },
          { name: "🎰 Lotarya Bileti — 100 💵", value: "lotar"  }
        )
    })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("sat").setDescription("💰 Envanterdeki bir eşyayı sat")
    .addStringOption(function(o) {
      return o.setName("esya").setDescription("Satılacak eşya").setRequired(true)
        .addChoices(
          { name: "🛡️ Kalkan",        value: "kalkan" },
          { name: "⚔️ Bilek Zırhı",   value: "bilek"  },
          { name: "🍀 Şans Muskası",   value: "sans"   },
          { name: "🏦 Kasa",           value: "kasa"   },
          { name: "💎 Elmas",          value: "elmas"  },
          { name: "⚡ Hız Botu",       value: "hiz"    },
          { name: "🎰 Lotarya Bileti", value: "lotar"  }
        )
    })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("slot").setDescription("🎰 Slot makinesi oyna")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis miktarı").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("rulet").setDescription("🎡 Rulet oyna")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis miktarı").setRequired(true).setMinValue(1) })
    .addStringOption(function(o) {
      return o.setName("renk").setDescription("Bahis rengi").setRequired(true)
        .addChoices(
          { name: "🔴 Kırmızı — 2x", value: "kirmizi" },
          { name: "⚫ Siyah — 2x",   value: "siyah"   },
          { name: "🟢 Yeşil — 14x",  value: "yesil"   }
        )
    })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("zar").setDescription("🎲 Zar at (bahissiz veya bahisli)")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis (boş = bahissiz)").setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("yazitura").setDescription("🪙 Yazı tura at")
    .addStringOption(function(o) {
      return o.setName("secim").setDescription("Seçimin").setRequired(true)
        .addChoices({ name: "Yazı", value: "yazi" }, { name: "Tura", value: "tura" })
    })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis miktarı").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("tkm").setDescription("🪨 Taş Kağıt Makas oyna")
    .addStringOption(function(o) {
      return o.setName("secim").setDescription("Seçimin").setRequired(true)
        .addChoices(
          { name: "🪨 Taş",   value: "tas"   },
          { name: "📄 Kağıt", value: "kagit" },
          { name: "✂️ Makas", value: "makas" }
        )
    })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("8ball").setDescription("🎱 Sihirli 8 topa soru sor")
    .addStringOption(function(o) { return o.setName("soru").setDescription("Sorunuz").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("sans").setDescription("🍀 Bugünkü şans puanını öğren").toJSON())

  c.push(new SlashCommandBuilder().setName("sandik").setDescription("🎁 Ücretsiz sandık aç (5dk)").toJSON())

  c.push(new SlashCommandBuilder().setName("lotarya").setDescription("🎰 Günlük lotaryaya katıl (Bilet gerekli)").toJSON())

  c.push(new SlashCommandBuilder().setName("yilanserdiven").setDescription("🐍 Yılan ve Merdiven mini oyunu").toJSON())

  c.push(new SlashCommandBuilder().setName("duello").setDescription("⚔️ Düello iste")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("bahis").setDescription("Bahis miktarı").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("kabul").setDescription("⚔️ Düello isteğini kabul et").toJSON())

  c.push(new SlashCommandBuilder().setName("reddet").setDescription("❌ Düello isteğini reddet").toJSON())

  c.push(new SlashCommandBuilder().setName("evlen").setDescription("💍 Evlilik teklif et")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("evlenkabul").setDescription("💒 Evlilik teklifini kabul et").toJSON())

  c.push(new SlashCommandBuilder().setName("bosan").setDescription("💔 Boşan").toJSON())

  c.push(new SlashCommandBuilder().setName("envanter").setDescription("🎒 Envanteri görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı (boş = kendin)") })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("hediye").setDescription("🎁 Eşya hediye et")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addStringOption(function(o) { return o.setName("esya").setDescription("Eşya adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("sor").setDescription("🤖 AI asistana soru sor")
    .addStringOption(function(o) { return o.setName("soru").setDescription("Sorunuz").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("ai-sifirla").setDescription("🔄 AI sohbet geçmişini temizle").toJSON())

  c.push(new SlashCommandBuilder().setName("play").setDescription("🎵 YouTube'dan şarkı çal / kuyruğa ekle")
    .addStringOption(function(o) { return o.setName("url").setDescription("YouTube URL").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("skip").setDescription("⏭️ Mevcut şarkıyı geç").toJSON())

  c.push(new SlashCommandBuilder().setName("pause").setDescription("⏸️ Müziği duraklat").toJSON())

  c.push(new SlashCommandBuilder().setName("resume").setDescription("▶️ Müziği devam ettir").toJSON())

  c.push(new SlashCommandBuilder().setName("stop").setDescription("⏹️ Müziği durdur ve ses kanalından çık").toJSON())

  c.push(new SlashCommandBuilder().setName("kuyruk").setDescription("📋 Mevcut müzik kuyruğunu görüntüle").toJSON())

  c.push(new SlashCommandBuilder().setName("admin-para").setDescription("[ADMİN] Para ver / al")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Miktar (negatif = al)").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-rol").setDescription("[ADMİN] Özel unvan ver")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addStringOption(function(o) { return o.setName("rol").setDescription("Unvan adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-seviye").setDescription("[ADMİN] Seviye ayarla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("seviye").setDescription("Yeni seviye").setRequired(true).setMinValue(1) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-ban").setDescription("[ADMİN] Bottan banla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-unban").setDescription("[ADMİN] Banı kaldır")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-warn").setDescription("[ADMİN] Uyarı ver (3=ban)")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-sifirla").setDescription("[ADMİN] Kullanıcı verisini sıfırla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .toJSON())

  c.push(new SlashCommandBuilder().setName("admin-duyuru").setDescription("[ADMİN] Duyuru gönder")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("mesaj").setDescription("Duyuru metni").setRequired(true) })
    .toJSON())

  return c
}

function findUserByName(name) {
  var lower = name.toLowerCase()
  for (var id in usernames) {
    if (usernames[id].toLowerCase() === lower) return id
  }
  return null
}

function resolveUser(interaction, optName) {
  var raw = getStr(interaction, optName)
  if (!raw) return null
  var cleaned = raw.replace(/[<@!>]/g, "").trim()
  if (/^\d+$/.test(cleaned)) return cleaned
  var byName = findUserByName(cleaned)
  return byName || cleaned
}

client.on(Events.ClientReady, async function() {
  console.log("=================================")
  console.log("🚀 WECORDY ULTRA BOT v5 AKTİF")
  console.log("=================================")
  try {
    var cmds = buildCommands()
    await client.application.commands.set(cmds)
    console.log("✅ " + cmds.length + " slash komutu kaydedildi")
  } catch (err) {
    console.error("❌ Slash komut kayıt hatası:", err.message)
  }
})

client.on(Events.InteractionCreate, async function(interaction) {
  try {
    if (!interaction.isCommand()) return

    var cmd      = interaction.commandName()
    var userId   = interaction.userId
    var username = interaction.user && interaction.user.username ? interaction.user.username : "Kullanici"
    var serverId = interaction.serverId

    if (!userId) return
    if (banned.has(userId)) return await interaction.reply("🔨 Bottan banlandığın için komut kullanamazsın.")

    initUser(userId, username)

    if (cmd === "ping") {
      return await interaction.reply("🏓 Pong! Bot aktif.")
    }

    if (cmd === "profil") {
      var tId   = resolveUser(interaction, "kullanici") || userId
      var tName = getName(tId)
      initUser(tId)
      var lvl     = levels[tId]
      var partner = married[tId] ? "💍 " + getName(married[tId]) : "Bekar"
      var s       = stats[tId]
      var total   = s.wins + s.losses
      var wr      = total > 0 ? Math.round((s.wins / total) * 100) : 0
      var msg = "👤 PROFİL — " + tName + "\n\n"
      msg += "💰 Bakiye: " + fmt(balances[tId]) + " 💵\n"
      msg += "⭐ Level: " + lvl.level + " | Rol: " + lvl.role + "\n"
      msg += "⚔️ Düello: " + s.wins + "W/" + s.losses + "L (%" + wr + ")\n"
      msg += "🎮 Toplam Oyun: " + s.gamesPlayed + "\n"
      msg += "🎒 Envanter: " + inventories[tId].length + " eşya\n"
      msg += partner
      if (warnings[tId]) msg += "\n⚠️ Uyarı: " + warnings[tId] + "/3"
      return await interaction.reply(msg)
    }

    if (cmd === "rank") {
      var tId   = resolveUser(interaction, "kullanici") || userId
      var tName = getName(tId)
      initUser(tId)
      var lvl    = levels[tId]
      var needed = lvl.level * 100
      var msg = "📈 RANK — " + tName + "\n\n"
      msg += "⭐ Level: " + lvl.level + "\n"
      msg += "⚡ XP: " + progressBar(lvl.xp, needed) + " " + lvl.xp + "/" + needed + "\n"
      msg += "🏅 Rol: " + lvl.role
      return await interaction.reply(msg)
    }

    if (cmd === "stats") {
      var s     = stats[userId]
      var total = s.wins + s.losses
      var wr    = total > 0 ? Math.round((s.wins / total) * 100) : 0
      var msg = "📊 İSTATİSTİKLER — " + username + "\n\n"
      msg += "⚔️ Düello: " + s.wins + "W / " + s.losses + "L (%" + wr + " WR)\n"
      msg += "🎮 Toplam Oyun: " + s.gamesPlayed + "\n"
      msg += "💵 Toplam Kazanılan: " + fmt(s.totalEarned) + " 💵\n"
      msg += "💸 Toplam Kaybedilen: " + fmt(s.totalLost) + " 💸\n"
      msg += "📈 Net: " + fmt(s.totalEarned - s.totalLost) + " 💵"
      return await interaction.reply(msg)
    }

    if (cmd === "siralama") {
      var turOpt = getStr(interaction, "tur")
      var byXP   = turOpt === "xp"
      var medals = ["🥇", "🥈", "🥉"]
      var sorted

      if (byXP) {
        sorted = Object.keys(levels).sort(function(a, b) {
          if (levels[b].level !== levels[a].level) return levels[b].level - levels[a].level
          return levels[b].xp - levels[a].xp
        }).slice(0, 10)
      } else {
        sorted = Object.keys(balances).sort(function(a, b) {
          return balances[b] - balances[a]
        }).slice(0, 10)
      }

      if (!sorted.length) return await interaction.reply("📊 Henüz veri yok.")

      var lines = sorted.map(function(id, i) {
        var medal = medals[i] || (i + 1) + "."
        var name  = getName(id)
        if (byXP) return medal + " " + name + " — Lvl " + levels[id].level + " (" + levels[id].xp + " XP)"
        return medal + " " + name + " — " + fmt(balances[id]) + " 💵"
      })

      var title = byXP ? "⭐ EN YÜKSEK SEVİYELER" : "💰 EN ZENGİN 10 KİŞİ"
      return await interaction.reply("🏆 " + title + "\n\n" + lines.join("\n"))
    }

    if (cmd === "balans") {
      return await interaction.reply("💰 BAKİYE\n\n" + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "calis") {
      var cdMs = hasItem(userId, "hiz") ? 15000 : 30000
      var wait = checkCooldown(userId, "calis", cdMs)
      if (wait) return await interaction.reply("⏳ " + formatMs(wait) + " sonra tekrar çalışabilirsin.")

      var jobs = [
        { name: "Yazılımcı",     emoji: "💻", min: 400,  max: 1000 },
        { name: "Doktor",        emoji: "🏥", min: 500,  max: 1500 },
        { name: "Avukat",        emoji: "⚖️", min: 600,  max: 1400 },
        { name: "Hacker",        emoji: "🕵️", min: 300,  max: 2000 },
        { name: "Müzisyen",      emoji: "🎸", min: 100,  max: 1200 },
        { name: "Şef",           emoji: "👨‍🍳", min: 250, max: 700  },
        { name: "Öğretmen",      emoji: "📚", min: 200,  max: 600  },
        { name: "Teslimatçı",    emoji: "🚴", min: 150,  max: 450  },
        { name: "Balıkçı",       emoji: "🎣", min: 120,  max: 500  },
        { name: "Çiftçi",        emoji: "🌾", min: 80,   max: 350  },
        { name: "YouTuber",      emoji: "📹", min: 0,    max: 3000 },
        { name: "Kripto Trader", emoji: "📈", min: -300, max: 2500 }
      ]

      var job    = jobs[random(0, jobs.length - 1)]
      var amount = random(job.min, job.max)

      if (amount <= 0) {
        var loss = Math.abs(amount) || random(50, 300)
        removeMoney(userId, loss)
        return await interaction.reply(job.emoji + " " + job.name + " olarak çalıştın ama bugün kötü gitti!\n\n-" + fmt(loss) + " 💸\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
      }

      addMoney(userId, amount)
      return await interaction.reply(job.emoji + " " + job.name + " olarak çalıştın!\n\n+" + fmt(amount) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "gunluk") {
      var wait = checkCooldown(userId, "gunluk", 86400000)
      if (wait) return await interaction.reply("📅 Günlük ödülünü aldın. " + formatMs(wait) + " sonra tekrar al.")
      var kasaX = hasItem(userId, "kasa") ? 2 : 1
      var bonus = random(1500, 3000) * kasaX
      addMoney(userId, bonus)
      return await interaction.reply("🎁 Günlük Ödül\n\n+" + fmt(bonus) + " 💵" + (kasaX === 2 ? " (🏦 Kasa x2!)" : ""))
    }

    if (cmd === "haftalik") {
      var wait = checkCooldown(userId, "haftalik", 604800000)
      if (wait) return await interaction.reply("📆 Haftalık ödülünü aldın. " + formatMs(wait) + " sonra tekrar al.")
      var bonus = random(10000, 25000)
      addMoney(userId, bonus)
      return await interaction.reply("🎊 Haftalık Ödül\n\n+" + fmt(bonus) + " 💵")
    }

    if (cmd === "faiz") {
      var wait = checkCooldown(userId, "faiz", 86400000)
      if (wait) return await interaction.reply("🏦 Faizi zaten aldın. " + formatMs(wait) + " sonra tekrar al.")
      if (balances[userId] < 100) return await interaction.reply("❌ Faiz için en az 100 💵 bakiyen olmalı.")
      var faiz = Math.floor(balances[userId] * 0.05)
      addMoney(userId, faiz)
      return await interaction.reply("🏦 Günlük Faiz (%5)\n\n+" + fmt(faiz) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "transfer") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var amount = getInt(interaction, "miktar")
      if (!amount || amount <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (tId === userId) return await interaction.reply("❌ Kendine para gönderemezsin.")
      if (amount > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      initUser(tId)
      removeMoney(userId, amount)
      addMoney(tId, amount)
      return await interaction.reply("✅ " + fmt(amount) + " 💵 → " + getName(tId) + " hesabına gönderildi.\n💰 Bakiyen: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "soygun") {
      var wait = checkCooldown(userId, "soygun", 120000)
      if (wait) return await interaction.reply("⏳ Soygun için " + formatMs(wait) + " bekle.")
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      if (tId === userId) return await interaction.reply("❌ Kendini soyamazsın.")
      initUser(tId)
      if (balances[tId] < 100) return await interaction.reply("❌ " + getName(tId) + " çok fakir.")
      stats[userId].gamesPlayed++
      if (Math.random() < 0.45) {
        var stolen = Math.min(random(100, 500), balances[tId])
        removeMoney(tId, stolen)
        addMoney(userId, stolen)
        stats[userId].wins++
        return await interaction.reply("🦹 SOYGUN BAŞARILI!\n\n" + getName(tId) + " kullanıcısından +" + fmt(stolen) + " 💵 çaldın!")
      } else {
        var fine = random(100, 300)
        removeMoney(userId, fine)
        stats[userId].losses++
        return await interaction.reply("👮 YAKALANDIN!\n\nCeza olarak -" + fmt(fine) + " 💵 ödedi.")
      }
    }

    if (cmd === "kumar") {
      var miktar = getInt(interaction, "miktar")
      if (!miktar || miktar <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (miktar > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, miktar)
      stats[userId].gamesPlayed++
      if (Math.random() < 0.40) {
        addMoney(userId, miktar * 2)
        stats[userId].wins++
        return await interaction.reply("🎲 KUMAR\n\n✅ KAZANDIN! +" + fmt(miktar) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
      } else {
        stats[userId].losses++
        return await interaction.reply("🎲 KUMAR\n\n❌ KAYBETTİN! -" + fmt(miktar) + " 💸\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
      }
    }

    if (cmd === "magaza") {
      var lines = shopItems.map(function(item) {
        var own = hasItem(userId, item.id) ? " ✅" : ""
        return item.name + own + " — " + fmt(item.price) + " 💵\n  " + item.desc
      })
      return await interaction.reply("🛒 MAĞAZA\n\n" + lines.join("\n\n") + "\n\n✅ = sahip olduğun eşyalar")
    }

    if (cmd === "satin") {
      var itemId = getStr(interaction, "esya")
      if (!itemId) return await interaction.reply("❌ Eşya seçmelisin.")
      var item = null
      for (var i = 0; i < shopItems.length; i++) {
        if (shopItems[i].id === itemId) { item = shopItems[i]; break }
      }
      if (!item) return await interaction.reply("❌ Geçersiz eşya.")
      if (hasItem(userId, item.id)) return await interaction.reply("❌ Bu eşyaya zaten sahipsin.")
      if (balances[userId] < item.price) return await interaction.reply("❌ Yeterli paran yok. Fiyat: " + fmt(item.price) + " 💵")
      removeMoney(userId, item.price)
      inventories[userId].push(item.id)
      return await interaction.reply("✅ " + item.name + " satın aldın!\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "sat") {
      var itemId = getStr(interaction, "esya")
      if (!itemId) return await interaction.reply("❌ Eşya seçmelisin.")
      var item = null
      for (var i = 0; i < shopItems.length; i++) {
        if (shopItems[i].id === itemId) { item = shopItems[i]; break }
      }
      if (!item) return await interaction.reply("❌ Geçersiz eşya.")
      var idx = inventories[userId].indexOf(item.id)
      if (idx === -1) return await interaction.reply("❌ Bu eşya envanterende yok.")
      var sellPrice = Math.floor(item.price * 0.6)
      inventories[userId].splice(idx, 1)
      addMoney(userId, sellPrice)
      return await interaction.reply("💰 " + item.name + " satıldı!\n\n+" + fmt(sellPrice) + " 💵 (%60 geri alış)\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "slot") {
      var bet = getInt(interaction, "miktar")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var emojis  = ["🍒", "💎", "🍉", "🍇", "🍋", "⭐", "🔔", "🍀"]
      var hasSans = hasItem(userId, "sans")
      var roll    = function() {
        if (hasSans && Math.random() < 0.05) return "💎"
        return emojis[random(0, emojis.length - 1)]
      }
      var a = roll(), b = roll(), c = roll()
      var win = 0, resultMsg = ""
      if (a === b && b === c) {
        win = a === "💎" ? bet * 10 : bet * 5
        resultMsg = a === "💎" ? "💎 ELMAS JACKPOT! +" + fmt(win) + " 💵" : "🎉 JACKPOT! +" + fmt(win) + " 💵"
        stats[userId].wins++
      } else if (a === b || a === c || b === c) {
        win = bet * 2
        resultMsg = "🔥 İki Eşleşme! +" + fmt(win) + " 💵"
        stats[userId].wins++
      } else {
        resultMsg = "❌ Kaybettin. -" + fmt(bet) + " 💸"
        stats[userId].losses++
      }
      if (win > 0) addMoney(userId, win)
      return await interaction.reply("🎰 SLOT\n\n╔══════════╗\n║ " + a + "  " + b + "  " + c + " ║\n╚══════════╝\n\n" + resultMsg + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "rulet") {
      var bet   = getInt(interaction, "miktar")
      var secim = getStr(interaction, "renk")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (!secim) return await interaction.reply("❌ Renk seçmelisin.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var num    = random(0, 36)
      var color  = num === 0 ? "yesil" : num % 2 === 0 ? "siyah" : "kirmizi"
      var emoji  = color === "yesil" ? "🟢" : color === "kirmizi" ? "🔴" : "⚫"
      var colorN = color === "yesil" ? "YEŞİL" : color === "kirmizi" ? "KIRMIZI" : "SİYAH"
      var win = 0
      if (secim === color) {
        win = color === "yesil" ? bet * 14 : bet * 2
        addMoney(userId, win)
        stats[userId].wins++
      } else {
        stats[userId].losses++
      }
      return await interaction.reply("🎡 RULET\n\nSayı: " + num + " " + emoji + " " + colorN + "\n\n" + (win > 0 ? "✅ Kazandın! +" + fmt(win) + " 💵" : "❌ Kaybettin. -" + fmt(bet) + " 💸") + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "zar") {
      var bet = getInt(interaction, "miktar")
      if (!bet || bet <= 0) return await interaction.reply("🎲 Zar attın: " + random(1, 6))
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var p1 = random(1, 6), p2 = random(1, 6)
      if (p1 > p2) {
        addMoney(userId, bet * 2)
        stats[userId].wins++
        return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n✅ Kazandın! +" + fmt(bet) + " 💵")
      } else if (p1 < p2) {
        stats[userId].losses++
        return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n❌ Kaybettin. -" + fmt(bet) + " 💸")
      } else {
        addMoney(userId, bet)
        return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n🤝 Berabere! Bahis iade.")
      }
    }

    if (cmd === "yazitura") {
      var secim = getStr(interaction, "secim")
      var bet   = getInt(interaction, "miktar")
      if (!secim) return await interaction.reply("❌ Yazı veya tura seçmelisin.")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var sonuc   = Math.random() < 0.5 ? "yazi" : "tura"
      var kazandi = secim === sonuc
      if (kazandi) { addMoney(userId, bet * 2); stats[userId].wins++ } else { stats[userId].losses++ }
      return await interaction.reply("🪙 YAZI TURA\n\nSonuç: " + sonuc.toUpperCase() + "\n" + (kazandi ? "✅ Kazandın! +" + fmt(bet) + " 💵" : "❌ Kaybettin. -" + fmt(bet) + " 💸") + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "tkm") {
      var kulSecim = getStr(interaction, "secim")
      if (!kulSecim) return await interaction.reply("❌ Taş, kağıt veya makas seçmelisin.")
      var secimler = ["tas", "kagit", "makas"]
      var botSecim = secimler[random(0, 2)]
      var kazanir  = { "tas": "makas", "kagit": "tas", "makas": "kagit" }
      var emojiMap = { "tas": "🪨", "kagit": "📄", "makas": "✂️" }
      var isimMap  = { "tas": "Taş", "kagit": "Kağıt", "makas": "Makas" }
      stats[userId].gamesPlayed++
      var sonuc = kulSecim === botSecim ? "🤝 Berabere!" : kazanir[kulSecim] === botSecim ? (stats[userId].wins++, "🏆 Kazandın!") : (stats[userId].losses++, "❌ Kaybettin!")
      return await interaction.reply("🪨 TAŞ KAĞIT MAKAS\n\nSen: " + emojiMap[kulSecim] + " " + isimMap[kulSecim] + "  vs  Bot: " + emojiMap[botSecim] + " " + isimMap[botSecim] + "\n\n" + sonuc)
    }

    if (cmd === "8ball") {
      var soru = getStr(interaction, "soru")
      if (!soru) return await interaction.reply("❌ Bir soru yazmalısın.")
      var cevaplar = [
        "🟢 Kesinlikle evet!", "🟢 Her şey buna işaret ediyor.",
        "🟢 Evet, şüphe yok.", "🟢 Çok muhtemel.",
        "🟡 Şu an söylemek zor.", "🟡 Tekrar dene.",
        "🟡 Cevap belirsiz.", "🟡 Odaklan ve tekrar sor.",
        "🔴 Sanmıyorum.", "🔴 Kesinlikle hayır.",
        "🔴 Hayır.", "🔴 Pek iyi görünmüyor."
      ]
      return await interaction.reply("🎱 \"" + soru + "\"\n\n" + cevaplar[random(0, cevaplar.length - 1)])
    }

    if (cmd === "sans") {
      var pct   = random(1, 100)
      var yorum = pct >= 80 ? "🌟 Bugün şansın var!" : pct >= 50 ? "😊 Fena değil." : "😬 Bugün dikkatli ol."
      return await interaction.reply("🍀 GÜNLÜK ŞANS\n\n" + progressBar(pct, 100) + " %" + pct + "\n\n" + yorum)
    }

    if (cmd === "sandik") {
      var wait = checkCooldown(userId, "sandik", 300000)
      if (wait) return await interaction.reply("⏳ Sandığı " + formatMs(wait) + " sonra açabilirsin.")
      var items = [
        { name: "💎 Elmas",        rarity: "✨ Efsanevi", chance: 3  },
        { name: "🔮 Kristal",      rarity: "🟣 Epik",     chance: 10 },
        { name: "🗡️ Kılıç",        rarity: "🔵 Nadir",   chance: 12 },
        { name: "🛡️ Kalkan",       rarity: "🔵 Nadir",   chance: 15 },
        { name: "🧪 İksir",        rarity: "⚪ Sıradan",  chance: 25 },
        { name: "🍀 Şans Yoncası", rarity: "⚪ Sıradan",  chance: 35 }
      ]
      var roll  = random(1, 100), cumul = 0, won = items[items.length - 1]
      for (var i = 0; i < items.length; i++) {
        cumul += items[i].chance
        if (roll <= cumul) { won = items[i]; break }
      }
      inventories[userId].push(won.name)
      return await interaction.reply("🎁 SANDIK AÇILDI\n\n" + won.name + "\nNadirlik: " + won.rarity)
    }

    if (cmd === "lotarya") {
      if (!hasItem(userId, "lotar")) return await interaction.reply("❌ Lotarya Bileti yok. /satin ile 100 💵'ye alabilirsin.")
      var wait = checkCooldown(userId, "lotarya", 86400000)
      if (wait) return await interaction.reply("🎰 Bugünkü lotaryaya katıldın. " + formatMs(wait) + " bekle.")
      var idx = inventories[userId].indexOf("lotar")
      inventories[userId].splice(idx, 1)
      var roll = random(1, 100), prize = 0, msg = ""
      if (roll <= 1)       { prize = 50000; msg = "🏆 BÜYÜK İKRAMİYE! +" + fmt(prize) + " 💵" }
      else if (roll <= 5)  { prize = 10000; msg = "🥇 1. Ödül! +" + fmt(prize) + " 💵" }
      else if (roll <= 15) { prize = 3000;  msg = "🥈 2. Ödül! +" + fmt(prize) + " 💵" }
      else if (roll <= 35) { prize = 500;   msg = "🥉 3. Ödül! +" + fmt(prize) + " 💵" }
      else                  { msg = "😔 Bu sefer olmadı. Yarın tekrar dene!" }
      if (prize > 0) addMoney(userId, prize)
      return await interaction.reply("🎰 LOTARYA\n\nNumaran: " + roll + "\n\n" + msg)
    }

    if (cmd === "yilanserdiven") {
      var wait = checkCooldown(userId, "yilanserdiven", 60000)
      if (wait) return await interaction.reply("⏳ " + formatMs(wait) + " sonra tekrar oynayabilirsin.")
      var pos         = random(1, 100)
      var yilanlar    = { 98: 78, 95: 75, 93: 73, 87: 24, 64: 60, 56: 53, 49: 11, 47: 26, 16: 6 }
      var merdivenler = { 1: 38, 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 }
      var yeniPos = pos, result = ""
      if (yilanlar[pos])    { yeniPos = yilanlar[pos];    result = "🐍 YILAN! " + pos + " → " + yeniPos + " (geri düştün!)" }
      else if (merdivenler[pos]) { yeniPos = merdivenler[pos]; result = "🪜 MERDİVEN! " + pos + " → " + yeniPos + " (ilerledi!)" }
      else                  { result = "Karedeysin: " + pos }
      var reward = Math.floor(yeniPos * 5)
      addMoney(userId, reward)
      stats[userId].gamesPlayed++
      return await interaction.reply("🐍🪜 YILAN VE MERDİVEN\n\nZar: " + random(1, 6) + "\n" + result + "\n\n+" + fmt(reward) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "duello") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var bet = getInt(interaction, "bahis")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir bahis miktarı gir.")
      if (tId === userId) return await interaction.reply("❌ Kendinle düello yapamazsın.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      initUser(tId)
      if (bet > balances[tId]) return await interaction.reply("❌ " + getName(tId) + " bu bahisi karşılayacak paraya sahip değil (" + fmt(balances[tId]) + " 💵).")
      duelRequests[tId] = { challenger: userId, bet: bet, expiresAt: Date.now() + 60000 }
      return await interaction.reply("⚔️ DÜELLO İSTEĞİ\n\n" + username + " → " + getName(tId) + "\n💰 Bahis: " + fmt(bet) + " 💵\n⏱️ 60 saniye\n\n/kabul veya /reddet")
    }

    if (cmd === "kabul") {
      var duel = duelRequests[userId]
      if (!duel) return await interaction.reply("⚔️ Aktif bir düello isteğin yok.")
      if (Date.now() > duel.expiresAt) { delete duelRequests[userId]; return await interaction.reply("❌ Düello süresi doldu.") }
      if (balances[userId] < duel.bet) { delete duelRequests[userId]; return await interaction.reply("❌ Artık yeterli paran yok.") }
      if (balances[duel.challenger] < duel.bet) { delete duelRequests[userId]; return await interaction.reply("❌ Rakibinin artık yeterli parası yok.") }
      var cBonus   = hasItem(duel.challenger, "bilek") ? 0.1 : 0
      var dBonus   = hasItem(userId, "bilek") ? 0.1 : 0
      var winP     = 0.5 + cBonus - dBonus
      removeMoney(userId, duel.bet)
      removeMoney(duel.challenger, duel.bet)
      var winnerId = Math.random() < winP ? duel.challenger : userId
      var prize    = duel.bet * 2
      addMoney(winnerId, prize)
      if (winnerId === userId) { stats[userId].wins++; if (stats[duel.challenger]) stats[duel.challenger].losses++ }
      else { if (stats[duel.challenger]) stats[duel.challenger].wins++; stats[userId].losses++ }
      var winnerName = getName(winnerId)
      delete duelRequests[userId]
      return await interaction.reply("⚔️ DÜELLO SONUCU\n\n🏆 Kazanan: " + winnerName + "\n💰 Ödül: " + fmt(prize) + " 💵")
    }

    if (cmd === "reddet") {
      if (!duelRequests[userId]) return await interaction.reply("⚔️ Reddedecek bir düello isteğin yok.")
      delete duelRequests[userId]
      return await interaction.reply("❌ Düello isteği reddedildi.")
    }

    if (cmd === "evlen") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      if (tId === userId) return await interaction.reply("❌ Kendinle evlenemezsin.")
      if (married[userId]) return await interaction.reply("❌ Zaten evlisin! Önce /bosan kullan.")
      marryRequests[tId] = { from: userId, expiresAt: Date.now() + 120000 }
      return await interaction.reply("💍 Evlilik Teklifi\n\n" + username + " → " + getName(tId) + "\n⏱️ 2 dakika\n\n/evlenkabul")
    }

    if (cmd === "evlenkabul") {
      var req = marryRequests[userId]
      if (!req) return await interaction.reply("💍 Sana gönderilmiş bir evlilik teklifi yok.")
      if (Date.now() > req.expiresAt) { delete marryRequests[userId]; return await interaction.reply("❌ Teklifin süresi doldu.") }
      if (married[userId]) return await interaction.reply("❌ Zaten evlisin.")
      if (married[req.from]) { delete marryRequests[userId]; return await interaction.reply("❌ Teklifte bulunan kişi artık evli.") }
      married[userId] = req.from
      married[req.from] = userId
      delete marryRequests[userId]
      return await interaction.reply("💒 Tebrikler!\n\n" + getName(req.from) + " ve " + username + " evlendi! 🎊")
    }

    if (cmd === "bosan") {
      if (!married[userId]) return await interaction.reply("❌ Evli değilsin.")
      var partnerId = married[userId]
      delete married[userId]
      delete married[partnerId]
      return await interaction.reply("💔 Boşandın.\n" + getName(partnerId) + " ile ilişkin sona erdi.")
    }

    if (cmd === "envanter") {
      var tId   = resolveUser(interaction, "kullanici") || userId
      var tName = getName(tId)
      var inv   = inventories[tId] || []
      if (!inv.length) return await interaction.reply("🎒 " + tName + " envanteri boş.")
      var counts = {}
      for (var i = 0; i < inv.length; i++) counts[inv[i]] = (counts[inv[i]] || 0) + 1
      var lines = Object.keys(counts).map(function(item) { return counts[item] > 1 ? item + " ×" + counts[item] : item })
      return await interaction.reply("🎒 " + tName + " Envanteri\n\n" + lines.join("\n"))
    }

    if (cmd === "hediye") {
      var tId      = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var itemName = getStr(interaction, "esya")
      if (!itemName) return await interaction.reply("❌ Eşya adı belirtmelisin.")
      if (tId === userId) return await interaction.reply("❌ Kendine hediye veremezsin.")
      var idx = inventories[userId].indexOf(itemName)
      if (idx === -1) return await interaction.reply("❌ Bu eşya envanterende yok.")
      inventories[userId].splice(idx, 1)
      initUser(tId)
      inventories[tId].push(itemName)
      return await interaction.reply("🎁 " + itemName + " → " + getName(tId) + " kullanıcısına hediye edildi!")
    }

    if (cmd === "sor") {
      var soru = getStr(interaction, "soru")
      if (!soru) return await interaction.reply("❌ Bir soru yazmalısın.")
      if (AI_KEY === "ANTHROPIC_API_KEY_BURAYA") {
        return await interaction.reply("🤖 AI özelliği henüz yapılandırılmamış.\n\nclaude.ai/settings/keys adresinden API anahtarı al ve bot kodundaki AI_KEY'e yaz.")
      }
      await interaction.reply("🤔 \"" + soru + "\"\n\nDüşünüyorum...")
      var cevap = await askAI(userId, soru)
      await interaction.followUp("🤖 " + cevap)
      return
    }

    if (cmd === "ai-sifirla") {
      aiHistory[userId] = []
      return await interaction.reply("🔄 AI sohbet geçmişin temizlendi.")
    }

    if (cmd === "play") {
      if (!serverId) return await interaction.reply("❌ Bu komutu sadece bir sunucuda kullanabilirsin.")
      var url = getStr(interaction, "url")
      if (!url) return await interaction.reply("❌ YouTube URL girmelisin.")
      if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
        return await interaction.reply("❌ Sadece YouTube linkleri desteklenir.")
      }

      if (!voiceQueues[serverId]) voiceQueues[serverId] = { items: [], playing: false, history: [], currentPlayer: null }

      var queue = voiceQueues[serverId]
      queue.items.push({ url: url, requestedBy: username })

      if (!voiceConns[serverId]) {
        try {
          var conn = new VoiceConnection(client, {
            channelId: interaction.channelId,
            serverId:  serverId
          })
          await conn.connect()
          voiceConns[serverId] = conn
          await interaction.reply("🔊 Ses kanalına bağlandı!\n\n🎵 Oynatılıyor: " + url + "\n👤 İsteyen: " + username)
          playNextInQueue(serverId)
        } catch(e) {
          delete voiceConns[serverId]
          return await interaction.reply("❌ Ses kanalına bağlanılamadı: " + e.message)
        }
      } else {
        var pos = queue.items.length
        await interaction.reply("📋 Kuyruğa eklendi!\n\n🎵 " + url + "\n👤 " + username + "\n📍 Sıra: " + pos)
        if (!queue.playing) playNextInQueue(serverId)
      }
      return
    }

    if (cmd === "skip") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var queue = voiceQueues[serverId]
      var conn  = voiceConns[serverId]
      if (!conn || !queue || !queue.playing) return await interaction.reply("❌ Şu an çalan bir şarkı yok.")
      if (queue.currentPlayer) queue.currentPlayer.stop()
      queue.items.shift()
      queue.playing = false
      if (queue.items.length > 0) {
        await interaction.reply("⏭️ Geçildi! Sıradaki şarkı oynatılıyor...")
        playNextInQueue(serverId)
      } else {
        await interaction.reply("⏭️ Geçildi! Kuyruk bitti.")
      }
      return
    }

    if (cmd === "pause") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn = voiceConns[serverId]
      if (!conn) return await interaction.reply("❌ Bot ses kanalında değil.")
      conn.pause()
      return await interaction.reply("⏸️ Müzik duraklatıldı.")
    }

    if (cmd === "resume") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn = voiceConns[serverId]
      if (!conn) return await interaction.reply("❌ Bot ses kanalında değil.")
      conn.resume()
      return await interaction.reply("▶️ Müzik devam ediyor.")
    }

    if (cmd === "stop") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn  = voiceConns[serverId]
      var queue = voiceQueues[serverId]
      if (!conn) return await interaction.reply("❌ Bot zaten ses kanalında değil.")
      conn.stopPlayer()
      await conn.disconnect()
      delete voiceConns[serverId]
      if (queue) { queue.items = []; queue.playing = false; queue.currentPlayer = null }
      return await interaction.reply("⏹️ Müzik durduruldu ve ses kanalından çıkıldı.")
    }

    if (cmd === "kuyruk") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var queue = voiceQueues[serverId]
      if (!queue || queue.items.length === 0) return await interaction.reply("📋 Kuyruk boş.")
      var lines = queue.items.map(function(item, i) {
        return (i === 0 ? "▶️ " : (i + 1) + ". ") + item.url + " — " + item.requestedBy
      })
      return await interaction.reply("📋 MÜZİK KUYRUĞU (" + queue.items.length + " şarkı)\n\n" + lines.join("\n"))
    }

    if (cmd === "admin-para") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId    = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var amount = getInt(interaction, "miktar")
      if (amount === null) return await interaction.reply("❌ Miktar belirtmelisin.")
      initUser(tId)
      if (amount >= 0) { addMoney(tId, amount); return await interaction.reply("✅ " + getName(tId) + " → +" + fmt(amount) + " 💵") }
      else { removeMoney(tId, Math.abs(amount)); return await interaction.reply("✅ " + getName(tId) + " → -" + fmt(Math.abs(amount)) + " 💵") }
    }

    if (cmd === "admin-rol") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId  = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var rol  = getStr(interaction, "rol")
      if (!rol) return await interaction.reply("❌ Rol adı belirtmelisin.")
      initUser(tId)
      levels[tId].role = rol
      return await interaction.reply("✅ " + getName(tId) + " → Unvan: " + rol)
    }

    if (cmd === "admin-seviye") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId    = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var seviye = getInt(interaction, "seviye")
      if (!seviye || seviye <= 0) return await interaction.reply("❌ Geçerli bir seviye gir.")
      initUser(tId)
      levels[tId].level = seviye
      levels[tId].xp    = 0
      var newRole = levelRoles[seviye]
      if (newRole) levels[tId].role = newRole
      return await interaction.reply("✅ " + getName(tId) + " → Seviye " + seviye)
    }

    if (cmd === "admin-ban") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      banned.add(tId)
      return await interaction.reply("🔨 " + getName(tId) + " bottan banlandı.")
    }

    if (cmd === "admin-unban") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      banned.delete(tId)
      return await interaction.reply("✅ " + getName(tId) + " banı kaldırıldı.")
    }

    if (cmd === "admin-warn") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      warnings[tId] = (warnings[tId] || 0) + 1
      if (warnings[tId] >= 3) { banned.add(tId); return await interaction.reply("🔨 " + getName(tId) + " 3 uyarıya ulaştı → otomatik banlandı.") }
      return await interaction.reply("⚠️ " + getName(tId) + " uyarıldı. (" + warnings[tId] + "/3)")
    }

    if (cmd === "admin-sifirla") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var tName = getName(tId)
      delete balances[tId]; delete levels[tId]; delete inventories[tId]
      delete stats[tId]; delete warnings[tId]; delete aiHistory[tId]
      return await interaction.reply("🔄 " + tName + " verisi tamamen sıfırlandı.")
    }

    if (cmd === "admin-duyuru") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var mesaj = getStr(interaction, "mesaj")
      if (!mesaj) return await interaction.reply("❌ Duyuru metni belirtmelisin.")
      announcements.push({ mesaj: mesaj, tarih: Date.now(), gonderildi: new Set() })
      return await interaction.reply("📢 Duyuru kaydedildi. Kullanıcılar bir sonraki etkileşimde görecek.")
    }

  } catch (err) {
    console.error("[INTERACTION HATA]", err)
    try { await interaction.reply("❌ Bir hata oluştu: " + err.message) } catch (e) {}
  }
})

client.on(Events.MessageCreate, async function(message) {
  try {
    if (!message || !message.content) return
    if (message.webhookId) return

    var userId   = message.userId
    var username = message.user && message.user.username ? message.user.username : "Kullanici"
    if (!userId) return
    if (banned.has(userId)) return

    initUser(userId, username)

    var now = Date.now()
    for (var d = 0; d < announcements.length; d++) {
      var ann = announcements[d]
      if (!ann.gonderildi.has(userId) && (now - ann.tarih) < 86400000) {
        ann.gonderildi.add(userId)
        try { await message.reply("📢 BOT DUYURUSU\n\n" + ann.mesaj) } catch(e) {}
      }
    }
    for (var d = announcements.length - 1; d >= 0; d--) {
      if ((now - announcements[d].tarih) >= 86400000) announcements.splice(d, 1)
    }

    if (!checkCooldown(userId, "_xp", 10000)) {
      levels[userId].xp += random(3, 8)
      var needed = levels[userId].level * 100
      if (levels[userId].xp >= needed) {
        levels[userId].xp = 0
        levels[userId].level++
        var newRole  = levelRoles[levels[userId].level]
        if (newRole) levels[userId].role = newRole
        var lvlBonus = levels[userId].level * 50
        addMoney(userId, lvlBonus)
        var lvlMsg = "🎉 SEVİYE ATLADIN!\n📈 Yeni Level: " + levels[userId].level
        if (newRole) lvlMsg += "\n🏅 Yeni Rol: " + newRole
        lvlMsg += "\n🎁 Bonus: +" + fmt(lvlBonus) + " 💵"
        await message.reply(lvlMsg)
      }
    }
  } catch (err) {
    console.error("[MESAJ HATA]", err)
  }
})

client.login(TOKEN)
