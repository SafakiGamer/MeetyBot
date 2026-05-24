const { Client, Events, GatewayIntentBits, SlashCommandBuilder, VoiceConnection, AudioPlayer } = require("@wecordy/core")
const playdl = require("play-dl")

const TOKEN      = "5373ad43e5f6c866ff7c37e8129703a23aeae1d3f11a95cbd134d372dd1ffe31d9e7f2d61a70b21e8bc9bb6b9ba1829da4ccd40e4932e157781bb12770b2b1"
const ADMIN_PERM = "8"
const ADMINS     = new Set()

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
const voiceQueues   = {}
const voiceConns    = {}
const userChannels  = {}
const announcements = []

const shopItems = [
  { id: "kalkan", name: "🛡️ Kalkan",       price: 500,  desc: "Düelloda hasar azaltır"        },
  { id: "bilek",  name: "⚔️ Bilek Zırhı",  price: 750,  desc: "Düelloda kazanma şansı artar"  },
  { id: "sans",   name: "🍀 Şans Muskası",  price: 300,  desc: "Slotta bonus şans"              },
  { id: "kasa",   name: "🏦 Kasa",          price: 2000, desc: "Günlük ödülü 2 katına çıkarır" },
  { id: "elmas",  name: "💎 Elmas",         price: 5000, desc: "Prestij eşyası"                 },
  { id: "hiz",    name: "⚡ Hız Botu",      price: 3000, desc: "Çalış cooldown 15sn olur"       },
  { id: "lotar",  name: "🎰 Lotarya Bileti",price: 100,  desc: "Günlük çekilişe katılım"        }
]

const levelRoles = {
  5: "🌱 Çaylak", 10: "⚡ Aktif", 15: "🔥 Pro",
  20: "👑 Efsane", 30: "💎 Tanrı", 50: "🌌 Ölümsüz"
}

function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function initUser(userId, username) {
  if (username) usernames[userId] = username
  if (!balances[userId])    balances[userId]    = 1000
  if (!levels[userId])      levels[userId]      = { xp: 0, level: 1, role: "🌱 Yeni" }
  if (!inventories[userId]) inventories[userId] = []
  if (!stats[userId])       stats[userId]       = { wins: 0, losses: 0, totalEarned: 0, totalLost: 0, gamesPlayed: 0 }
}

function getName(userId) { return usernames[userId] || ("Kullanıcı#" + String(userId).slice(-4)) }

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
  var now = Date.now(), expires = cooldowns[userId][cmd]
  if (expires && now < expires) return expires - now
  cooldowns[userId][cmd] = now + ms
  return 0
}

function formatMs(ms) {
  var s = Math.ceil(ms / 1000)
  if (s < 60) return s + " saniye"
  var m = Math.floor(s / 60), r = s % 60
  if (m < 60) return r > 0 ? m + "dk " + r + "sn" : m + " dakika"
  var h = Math.floor(m / 60), rm = m % 60
  return rm > 0 ? h + "sa " + rm + "dk" : h + " saat"
}

function pBar(cur, max) {
  var f = Math.round(Math.min(cur / max, 1) * 12)
  return "▓".repeat(f) + "░".repeat(12 - f)
}

function isAdmin(uid) { return ADMINS.has(uid) }
function hasItem(uid, id) { initUser(uid); return inventories[uid].includes(id) }
function fmt(n) { return Number(n).toLocaleString("tr-TR") }
function getStr(ix, name) { return ix.getString(name) || null }
function getInt(ix, name) { var v = ix.getInteger(name); return (v !== null && v !== undefined) ? v : null }

function resolveUser(ix, name) {
  var raw = getStr(ix, name)
  if (!raw) return null
  var cleaned = raw.replace(/[<@!>]/g, "").trim()
  if (/^\d+$/.test(cleaned)) return cleaned
  var lower = cleaned.toLowerCase()
  for (var id in usernames) {
    if (usernames[id].toLowerCase() === lower) return id
  }
  return cleaned
}

async function streamWithPlayDL(serverId, item) {
  var queue = voiceQueues[serverId]
  var conn  = voiceConns[serverId]
  if (!conn || !queue) return

  queue.playing   = true
  queue.currentTitle = item.title || item.url

  try {
    var info = await playdl.video_info(item.url)
    var title = info && info.video_details ? info.video_details.title : item.url
    queue.currentTitle = title

    var stream = await playdl.stream(item.url, { quality: 2 })

    var audioPlayer = AudioPlayer.createStream(conn._audioTrack || null, title)

    if (!conn._audioTrack) {
      throw new Error("Ses kanalı bağlantısı hazır değil.")
    }

    audioPlayer = AudioPlayer.createStream(conn._audioTrack, title)
    queue.currentPlayer = audioPlayer
    audioPlayer.start()

    stream.stream.on("data", function(chunk) {
      var { extractOpusFramesIncremental } = require("@wecordy/core")
      if (extractOpusFramesIncremental) {
        var result = extractOpusFramesIncremental(chunk, 0)
        if (result.frames.length > 0) audioPlayer.pushFrames(result.frames)
      }
    })

    stream.stream.on("end", function() {
      audioPlayer.markEnd()
      queue.history = queue.history || []
      queue.history.push({ title: queue.currentTitle, url: item.url })
      if (queue.history.length > 10) queue.history.shift()
      queue.items.shift()
      queue.playing = false
      if (queue.items.length > 0) {
        setTimeout(function() { streamWithPlayDL(serverId, queue.items[0]) }, 500)
      }
    })

    stream.stream.on("error", function(e) {
      console.error("[STREAM HATA]", e.message)
      queue.items.shift()
      queue.playing = false
      if (queue.items.length > 0) {
        setTimeout(function() { streamWithPlayDL(serverId, queue.items[0]) }, 500)
      }
    })

  } catch (e) {
    console.error("[STREAM HATA]", e.message)
    queue.items.shift()
    queue.playing = false
    if (queue.items.length > 0) {
      setTimeout(function() { streamWithPlayDL(serverId, queue.items[0]) }, 500)
    }
  }
}

function buildCommands() {
  var c = []

  c.push(new SlashCommandBuilder().setName("ping").setDescription("🏓 Botun aktif olduğunu kontrol et").toJSON())

  c.push(new SlashCommandBuilder().setName("profil").setDescription("👤 Profil bilgilerini görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı (boş = kendin)") }).toJSON())

  c.push(new SlashCommandBuilder().setName("rank").setDescription("📈 Seviye ve XP bilgini görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı") }).toJSON())

  c.push(new SlashCommandBuilder().setName("stats").setDescription("📊 Oyun istatistiklerini görüntüle").toJSON())

  c.push(new SlashCommandBuilder().setName("siralama").setDescription("🏆 Sunucu sıralaması")
    .addStringOption(function(o) {
      return o.setName("tur").setDescription("Sıralama türü")
        .addChoices({ name: "💰 Para", value: "para" }, { name: "⭐ Seviye", value: "xp" })
    }).toJSON())

  c.push(new SlashCommandBuilder().setName("balans").setDescription("💰 Mevcut bakiyeni gör").toJSON())

  c.push(new SlashCommandBuilder().setName("calis").setDescription("💼 Çalışarak para kazan (30sn)").toJSON())

  c.push(new SlashCommandBuilder().setName("gunluk").setDescription("🎁 Günlük ödülünü al (24sa)").toJSON())

  c.push(new SlashCommandBuilder().setName("haftalik").setDescription("🎊 Haftalık büyük ödülü al (7 gün)").toJSON())

  c.push(new SlashCommandBuilder().setName("faiz").setDescription("🏦 Bakiyene günlük %5 faiz al (24sa)").toJSON())

  c.push(new SlashCommandBuilder().setName("transfer").setDescription("💸 Para gönder")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Miktar").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("soygun").setDescription("🦹 Başka birini soy (%45 başarı, 2dk)")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("kumar").setDescription("🎲 %40 şansla 2 katı kazan")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("magaza").setDescription("🛒 Bot mağazasını gör").toJSON())

  c.push(new SlashCommandBuilder().setName("satin").setDescription("🛒 Eşya satın al")
    .addStringOption(function(o) {
      return o.setName("esya").setDescription("Eşya").setRequired(true).addChoices(
        { name: "🛡️ Kalkan — 500 💵",         value: "kalkan" },
        { name: "⚔️ Bilek Zırhı — 750 💵",    value: "bilek"  },
        { name: "🍀 Şans Muskası — 300 💵",    value: "sans"   },
        { name: "🏦 Kasa — 2000 💵",           value: "kasa"   },
        { name: "💎 Elmas — 5000 💵",          value: "elmas"  },
        { name: "⚡ Hız Botu — 3000 💵",       value: "hiz"    },
        { name: "🎰 Lotarya Bileti — 100 💵",  value: "lotar"  }
      )
    }).toJSON())

  c.push(new SlashCommandBuilder().setName("sat").setDescription("💰 Eşya sat (%60 geri alış)")
    .addStringOption(function(o) {
      return o.setName("esya").setDescription("Eşya").setRequired(true).addChoices(
        { name: "🛡️ Kalkan",         value: "kalkan" },
        { name: "⚔️ Bilek Zırhı",    value: "bilek"  },
        { name: "🍀 Şans Muskası",    value: "sans"   },
        { name: "🏦 Kasa",            value: "kasa"   },
        { name: "💎 Elmas",           value: "elmas"  },
        { name: "⚡ Hız Botu",        value: "hiz"    },
        { name: "🎰 Lotarya Bileti",  value: "lotar"  }
      )
    }).toJSON())

  c.push(new SlashCommandBuilder().setName("slot").setDescription("🎰 Slot makinesi oyna")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("rulet").setDescription("🎡 Rulet oyna")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis").setRequired(true).setMinValue(1) })
    .addStringOption(function(o) {
      return o.setName("renk").setDescription("Renk").setRequired(true).addChoices(
        { name: "🔴 Kırmızı — 2x", value: "kirmizi" },
        { name: "⚫ Siyah — 2x",   value: "siyah"   },
        { name: "🟢 Yeşil — 14x",  value: "yesil"   }
      )
    }).toJSON())

  c.push(new SlashCommandBuilder().setName("zar").setDescription("🎲 Zar at")
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis (boş = bahissiz)").setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("yazitura").setDescription("🪙 Yazı tura")
    .addStringOption(function(o) {
      return o.setName("secim").setDescription("Seçim").setRequired(true)
        .addChoices({ name: "Yazı", value: "yazi" }, { name: "Tura", value: "tura" })
    })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Bahis").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("tkm").setDescription("🪨 Taş Kağıt Makas")
    .addStringOption(function(o) {
      return o.setName("secim").setDescription("Seçim").setRequired(true).addChoices(
        { name: "🪨 Taş",  value: "tas"   },
        { name: "📄 Kağıt", value: "kagit" },
        { name: "✂️ Makas", value: "makas" }
      )
    }).toJSON())

  c.push(new SlashCommandBuilder().setName("8ball").setDescription("🎱 Sihirli 8 top")
    .addStringOption(function(o) { return o.setName("soru").setDescription("Sorunuz").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("sans").setDescription("🍀 Bugünkü şans puanı").toJSON())

  c.push(new SlashCommandBuilder().setName("sandik").setDescription("🎁 Ücretsiz sandık aç (5dk)").toJSON())

  c.push(new SlashCommandBuilder().setName("lotarya").setDescription("🎰 Günlük lotarya (Bilet gerekli)").toJSON())

  c.push(new SlashCommandBuilder().setName("yilanserdiven").setDescription("🐍 Yılan ve Merdiven mini oyunu").toJSON())

  c.push(new SlashCommandBuilder().setName("duello").setDescription("⚔️ Düello iste")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("bahis").setDescription("Bahis").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("kabul").setDescription("⚔️ Düello kabul et").toJSON())
  c.push(new SlashCommandBuilder().setName("reddet").setDescription("❌ Düello reddet").toJSON())

  c.push(new SlashCommandBuilder().setName("evlen").setDescription("💍 Evlilik teklif et")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("evlenkabul").setDescription("💒 Evlilik teklifini kabul et").toJSON())
  c.push(new SlashCommandBuilder().setName("bosan").setDescription("💔 Boşan").toJSON())

  c.push(new SlashCommandBuilder().setName("envanter").setDescription("🎒 Envanteri görüntüle")
    .addStringOption(function(o) { return o.setName("kullanici").setDescription("Kullanıcı adı (boş = kendin)") }).toJSON())

  c.push(new SlashCommandBuilder().setName("hediye").setDescription("🎁 Eşya hediye et")
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addStringOption(function(o) { return o.setName("esya").setDescription("Eşya adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("play").setDescription("🎵 YouTube'dan şarkı çal / kuyruğa ekle")
    .addStringOption(function(o) { return o.setName("url").setDescription("YouTube URL veya arama terimi").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("skip").setDescription("⏭️ Şarkıyı geç").toJSON())
  c.push(new SlashCommandBuilder().setName("pause").setDescription("⏸️ Müziği duraklat").toJSON())
  c.push(new SlashCommandBuilder().setName("resume").setDescription("▶️ Müziği devam ettir").toJSON())
  c.push(new SlashCommandBuilder().setName("stop").setDescription("⏹️ Müziği durdur ve çık").toJSON())
  c.push(new SlashCommandBuilder().setName("kuyruk").setDescription("📋 Müzik kuyruğunu göster").toJSON())

  c.push(new SlashCommandBuilder().setName("nowplaying").setDescription("🎵 Şu an çalan şarkıyı göster").toJSON())

  c.push(new SlashCommandBuilder().setName("admin-para").setDescription("[ADMİN] Para ver / al")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("miktar").setDescription("Miktar (negatif = al)").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-rol").setDescription("[ADMİN] Unvan ver")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addStringOption(function(o) { return o.setName("rol").setDescription("Unvan adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-seviye").setDescription("[ADMİN] Seviye ayarla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) })
    .addIntegerOption(function(o) { return o.setName("seviye").setDescription("Yeni seviye").setRequired(true).setMinValue(1) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-ban").setDescription("[ADMİN] Bottan banla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-unban").setDescription("[ADMİN] Banı kaldır")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-warn").setDescription("[ADMİN] Uyarı ver (3=ban)")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-sifirla").setDescription("[ADMİN] Kullanıcı verisi sıfırla")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("hedef").setDescription("Kullanıcı adı").setRequired(true) }).toJSON())

  c.push(new SlashCommandBuilder().setName("admin-duyuru").setDescription("[ADMİN] Duyuru gönder")
    .setDefaultMemberPermissions(ADMIN_PERM)
    .addStringOption(function(o) { return o.setName("mesaj").setDescription("Duyuru metni").setRequired(true) }).toJSON())

  return c
}

client.on(Events.ClientReady, async function() {
  console.log("=================================")
  console.log("🚀 WECORDY ULTRA BOT v6 AKTİF")
  console.log("=================================")
  try {
    var cmds = buildCommands()
    await client.application.commands.set(cmds)
    console.log("✅ " + cmds.length + " slash komutu kaydedildi")
  } catch (err) {
    console.error("❌ Komut kayıt hatası:", err.message)
  }
})

client.on(Events.VoiceChannelJoin, function(payload) {
  if (!payload) return
  var uid = payload.userId || (payload.member && payload.member.userId)
  var cid = payload.channelId
  if (uid && cid) userChannels[uid] = cid
})

client.on(Events.VoiceChannelDisconnect, function(payload) {
  if (!payload) return
  var uid = payload.userId || (payload.member && payload.member.userId)
  if (uid) delete userChannels[uid]
})

client.on(Events.VoiceChannelMove, function(payload) {
  if (!payload) return
  var uid = payload.userId || (payload.member && payload.member.userId)
  var cid = payload.newChannelId || payload.channelId
  if (uid && cid) userChannels[uid] = cid
})

client.on(Events.InteractionCreate, async function(interaction) {
  try {
    if (!interaction.isCommand()) return

    var cmd      = interaction.commandName()
    var userId   = interaction.userId
    var serverId = interaction.serverId
    var username = interaction.user && interaction.user.username ? interaction.user.username : "Kullanici"

    if (!userId) return
    if (banned.has(userId)) return await interaction.reply("🔨 Bottan banlandığın için komut kullanamazsın.")

    initUser(userId, username)

    if (cmd === "ping") {
      return await interaction.reply("🏓 Pong! Bot aktif.")
    }

    if (cmd === "profil") {
      var tId = resolveUser(interaction, "kullanici") || userId
      initUser(tId)
      var lvl = levels[tId], s = stats[tId]
      var total = s.wins + s.losses, wr = total > 0 ? Math.round(s.wins / total * 100) : 0
      var msg = "👤 PROFİL — " + getName(tId) + "\n\n"
      msg += "💰 Bakiye: " + fmt(balances[tId]) + " 💵\n"
      msg += "⭐ Level: " + lvl.level + " | Rol: " + lvl.role + "\n"
      msg += "⚔️ Düello: " + s.wins + "W/" + s.losses + "L (%" + wr + ")\n"
      msg += "🎮 Toplam Oyun: " + s.gamesPlayed + "\n"
      msg += "🎒 Envanter: " + inventories[tId].length + " eşya\n"
      msg += (married[tId] ? "💍 " + getName(married[tId]) : "Bekar")
      if (warnings[tId]) msg += "\n⚠️ Uyarı: " + warnings[tId] + "/3"
      return await interaction.reply(msg)
    }

    if (cmd === "rank") {
      var tId = resolveUser(interaction, "kullanici") || userId
      initUser(tId)
      var lvl = levels[tId], needed = lvl.level * 100
      return await interaction.reply("📈 RANK — " + getName(tId) + "\n\n⭐ Level: " + lvl.level + "\n⚡ XP: " + pBar(lvl.xp, needed) + " " + lvl.xp + "/" + needed + "\n🏅 Rol: " + lvl.role)
    }

    if (cmd === "stats") {
      var s = stats[userId], total = s.wins + s.losses, wr = total > 0 ? Math.round(s.wins / total * 100) : 0
      return await interaction.reply("📊 İSTATİSTİKLER — " + username + "\n\n⚔️ Düello: " + s.wins + "W / " + s.losses + "L (%" + wr + " WR)\n🎮 Toplam Oyun: " + s.gamesPlayed + "\n💵 Kazanılan: " + fmt(s.totalEarned) + " 💵\n💸 Kaybedilen: " + fmt(s.totalLost) + " 💸\n📈 Net: " + fmt(s.totalEarned - s.totalLost) + " 💵")
    }

    if (cmd === "siralama") {
      var byXP = getStr(interaction, "tur") === "xp"
      var medals = ["🥇", "🥈", "🥉"]
      var sorted = byXP
        ? Object.keys(levels).sort(function(a, b) { return levels[b].level !== levels[a].level ? levels[b].level - levels[a].level : levels[b].xp - levels[a].xp }).slice(0, 10)
        : Object.keys(balances).sort(function(a, b) { return balances[b] - balances[a] }).slice(0, 10)
      if (!sorted.length) return await interaction.reply("📊 Henüz veri yok.")
      var lines = sorted.map(function(id, i) {
        var m = medals[i] || (i + 1) + "."
        return byXP ? m + " " + getName(id) + " — Lvl " + levels[id].level : m + " " + getName(id) + " — " + fmt(balances[id]) + " 💵"
      })
      return await interaction.reply("🏆 " + (byXP ? "⭐ EN YÜKSEK SEVİYELER" : "💰 EN ZENGİN 10 KİŞİ") + "\n\n" + lines.join("\n"))
    }

    if (cmd === "balans") {
      return await interaction.reply("💰 BAKİYE\n\n" + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "calis") {
      var wait = checkCooldown(userId, "calis", hasItem(userId, "hiz") ? 15000 : 30000)
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
        { name: "YouTuber",      emoji: "📹", min: 0,    max: 3000 },
        { name: "Kripto Trader", emoji: "📈", min: -300, max: 2500 }
      ]
      var job = jobs[random(0, jobs.length - 1)], amount = random(job.min, job.max)
      if (amount <= 0) {
        var loss = Math.abs(amount) || random(50, 200)
        removeMoney(userId, loss)
        return await interaction.reply(job.emoji + " " + job.name + " olarak çalıştın ama bugün kötü gitti!\n\n-" + fmt(loss) + " 💸\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
      }
      addMoney(userId, amount)
      return await interaction.reply(job.emoji + " " + job.name + " olarak çalıştın!\n\n+" + fmt(amount) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "gunluk") {
      var wait = checkCooldown(userId, "gunluk", 86400000)
      if (wait) return await interaction.reply("📅 Günlük ödülünü aldın. " + formatMs(wait) + " sonra tekrar al.")
      var bonus = random(1500, 3000) * (hasItem(userId, "kasa") ? 2 : 1)
      addMoney(userId, bonus)
      return await interaction.reply("🎁 Günlük Ödül\n\n+" + fmt(bonus) + " 💵" + (hasItem(userId, "kasa") ? " (🏦 Kasa x2!)" : ""))
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
        return await interaction.reply("👮 YAKALANDIN!\n\nCeza: -" + fmt(fine) + " 💸")
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
        return item.name + (hasItem(userId, item.id) ? " ✅" : "") + " — " + fmt(item.price) + " 💵\n  " + item.desc
      })
      return await interaction.reply("🛒 MAĞAZA\n\n" + lines.join("\n\n"))
    }

    if (cmd === "satin") {
      var itemId = getStr(interaction, "esya")
      if (!itemId) return await interaction.reply("❌ Eşya seçmelisin.")
      var item = shopItems.find(function(i) { return i.id === itemId })
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
      var item = shopItems.find(function(i) { return i.id === itemId })
      if (!item) return await interaction.reply("❌ Geçersiz eşya.")
      var idx = inventories[userId].indexOf(item.id)
      if (idx === -1) return await interaction.reply("❌ Bu eşya envanterende yok.")
      inventories[userId].splice(idx, 1)
      var sellPrice = Math.floor(item.price * 0.6)
      addMoney(userId, sellPrice)
      return await interaction.reply("💰 " + item.name + " satıldı!\n\n+" + fmt(sellPrice) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "slot") {
      var bet = getInt(interaction, "miktar")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok. Bakiye: " + fmt(balances[userId]) + " 💵")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var emojis = ["🍒", "💎", "🍉", "🍇", "🍋", "⭐", "🔔", "🍀"]
      var hasSans = hasItem(userId, "sans")
      var roll = function() { return hasSans && Math.random() < 0.05 ? "💎" : emojis[random(0, emojis.length - 1)] }
      var a = roll(), b = roll(), c = roll(), win = 0, msg = ""
      if (a === b && b === c) {
        win = a === "💎" ? bet * 10 : bet * 5
        msg = (a === "💎" ? "💎 ELMAS JACKPOT!" : "🎉 JACKPOT!") + " +" + fmt(win) + " 💵"
        stats[userId].wins++
      } else if (a === b || a === c || b === c) {
        win = bet * 2; msg = "🔥 İki Eşleşme! +" + fmt(win) + " 💵"; stats[userId].wins++
      } else {
        msg = "❌ Kaybettin. -" + fmt(bet) + " 💸"; stats[userId].losses++
      }
      if (win > 0) addMoney(userId, win)
      return await interaction.reply("🎰 SLOT\n\n[ " + a + " | " + b + " | " + c + " ]\n\n" + msg + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "rulet") {
      var bet = getInt(interaction, "miktar"), secim = getStr(interaction, "renk")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (!secim) return await interaction.reply("❌ Renk seçmelisin.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok.")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var num = random(0, 36), color = num === 0 ? "yesil" : num % 2 === 0 ? "siyah" : "kirmizi"
      var emoji = { yesil: "🟢", kirmizi: "🔴", siyah: "⚫" }[color]
      var colorN = { yesil: "YEŞİL", kirmizi: "KIRMIZI", siyah: "SİYAH" }[color]
      var win = 0
      if (secim === color) { win = color === "yesil" ? bet * 14 : bet * 2; addMoney(userId, win); stats[userId].wins++ } else { stats[userId].losses++ }
      return await interaction.reply("🎡 RULET\n\nSayı: " + num + " " + emoji + " " + colorN + "\n\n" + (win > 0 ? "✅ Kazandın! +" + fmt(win) + " 💵" : "❌ Kaybettin. -" + fmt(bet) + " 💸") + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "zar") {
      var bet = getInt(interaction, "miktar")
      if (!bet || bet <= 0) return await interaction.reply("🎲 Zar attın: " + random(1, 6))
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok.")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var p1 = random(1, 6), p2 = random(1, 6)
      if (p1 > p2) { addMoney(userId, bet * 2); stats[userId].wins++; return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n✅ Kazandın! +" + fmt(bet) + " 💵") }
      if (p1 < p2) { stats[userId].losses++; return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n❌ Kaybettin. -" + fmt(bet) + " 💸") }
      addMoney(userId, bet); return await interaction.reply("🎲 Sen: " + p1 + " — Bot: " + p2 + "\n\n🤝 Berabere! Bahis iade.")
    }

    if (cmd === "yazitura") {
      var secim = getStr(interaction, "secim"), bet = getInt(interaction, "miktar")
      if (!secim) return await interaction.reply("❌ Yazı veya tura seçmelisin.")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir miktar gir.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok.")
      removeMoney(userId, bet)
      stats[userId].gamesPlayed++
      var sonuc = Math.random() < 0.5 ? "yazi" : "tura", kazandi = secim === sonuc
      if (kazandi) { addMoney(userId, bet * 2); stats[userId].wins++ } else { stats[userId].losses++ }
      return await interaction.reply("🪙 YAZI TURA\n\nSonuç: " + sonuc.toUpperCase() + "\n" + (kazandi ? "✅ Kazandın! +" + fmt(bet) + " 💵" : "❌ Kaybettin. -" + fmt(bet) + " 💸") + "\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "tkm") {
      var k = getStr(interaction, "secim")
      if (!k) return await interaction.reply("❌ Seçim yapmalısın.")
      var s = ["tas", "kagit", "makas"], bot = s[random(0, 2)]
      var beats = { tas: "makas", kagit: "tas", makas: "kagit" }
      var emo = { tas: "🪨", kagit: "📄", makas: "✂️" }, ism = { tas: "Taş", kagit: "Kağıt", makas: "Makas" }
      stats[userId].gamesPlayed++
      var res = k === bot ? "🤝 Berabere!" : beats[k] === bot ? (stats[userId].wins++, "🏆 Kazandın!") : (stats[userId].losses++, "❌ Kaybettin!")
      return await interaction.reply("🪨 TAŞ KAĞIT MAKAS\n\nSen: " + emo[k] + " " + ism[k] + "  vs  Bot: " + emo[bot] + " " + ism[bot] + "\n\n" + res)
    }

    if (cmd === "8ball") {
      var soru = getStr(interaction, "soru")
      if (!soru) return await interaction.reply("❌ Bir soru yazmalısın.")
      var cvp = ["🟢 Kesinlikle evet!", "🟢 Her şey buna işaret ediyor.", "🟢 Evet, şüphe yok.", "🟢 Çok muhtemel.",
        "🟡 Şu an söylemek zor.", "🟡 Tekrar dene.", "🟡 Cevap belirsiz.", "🟡 Odaklan ve sor.",
        "🔴 Sanmıyorum.", "🔴 Kesinlikle hayır.", "🔴 Hayır.", "🔴 Pek iyi görünmüyor."]
      return await interaction.reply("🎱 \"" + soru + "\"\n\n" + cvp[random(0, cvp.length - 1)])
    }

    if (cmd === "sans") {
      var pct = random(1, 100)
      var yorum = pct >= 80 ? "🌟 Bugün şansın var!" : pct >= 50 ? "😊 Fena değil." : "😬 Bugün dikkatli ol."
      return await interaction.reply("🍀 GÜNLÜK ŞANS\n\n" + pBar(pct, 100) + " %" + pct + "\n\n" + yorum)
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
      var roll = random(1, 100), cumul = 0, won = items[items.length - 1]
      for (var i = 0; i < items.length; i++) { cumul += items[i].chance; if (roll <= cumul) { won = items[i]; break } }
      inventories[userId].push(won.name)
      return await interaction.reply("🎁 SANDIK AÇILDI\n\n" + won.name + "\nNadirlik: " + won.rarity)
    }

    if (cmd === "lotarya") {
      if (!hasItem(userId, "lotar")) return await interaction.reply("❌ Lotarya Bileti yok. /satin ile 100 💵'ye alabilirsin.")
      var wait = checkCooldown(userId, "lotarya", 86400000)
      if (wait) return await interaction.reply("🎰 Bugünkü lotaryaya katıldın. " + formatMs(wait) + " bekle.")
      inventories[userId].splice(inventories[userId].indexOf("lotar"), 1)
      var roll = random(1, 100), prize = 0, msg = ""
      if (roll <= 1) { prize = 50000; msg = "🏆 BÜYÜK İKRAMİYE! +" + fmt(prize) + " 💵" }
      else if (roll <= 5)  { prize = 10000; msg = "🥇 1. Ödül! +" + fmt(prize) + " 💵" }
      else if (roll <= 15) { prize = 3000;  msg = "🥈 2. Ödül! +" + fmt(prize) + " 💵" }
      else if (roll <= 35) { prize = 500;   msg = "🥉 3. Ödül! +" + fmt(prize) + " 💵" }
      else { msg = "😔 Bu sefer olmadı. Yarın tekrar dene!" }
      if (prize > 0) addMoney(userId, prize)
      return await interaction.reply("🎰 LOTARYA\n\nNumaran: " + roll + "\n\n" + msg)
    }

    if (cmd === "yilanserdiven") {
      var wait = checkCooldown(userId, "yilanserdiven", 60000)
      if (wait) return await interaction.reply("⏳ " + formatMs(wait) + " sonra tekrar oynayabilirsin.")
      var pos = random(1, 100)
      var yilanlar = { 98: 78, 95: 75, 93: 73, 87: 24, 64: 60, 56: 53, 49: 11, 47: 26, 16: 6 }
      var merdivenler = { 1: 38, 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 }
      var yeniPos = pos, res = ""
      if (yilanlar[pos]) { yeniPos = yilanlar[pos]; res = "🐍 YILAN! " + pos + " → " + yeniPos + " (geri düştün!)" }
      else if (merdivenler[pos]) { yeniPos = merdivenler[pos]; res = "🪜 MERDİVEN! " + pos + " → " + yeniPos + " (ilerledi!)" }
      else { res = "Karedeysin: " + pos }
      var reward = Math.floor(yeniPos * 5)
      addMoney(userId, reward)
      stats[userId].gamesPlayed++
      return await interaction.reply("🐍🪜 YILAN VE MERDİVEN\n\nZar: " + random(1, 6) + "\n" + res + "\n\n+" + fmt(reward) + " 💵\n💰 Bakiye: " + fmt(balances[userId]) + " 💵")
    }

    if (cmd === "duello") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var bet = getInt(interaction, "bahis")
      if (!bet || bet <= 0) return await interaction.reply("❌ Geçerli bir bahis gir.")
      if (tId === userId) return await interaction.reply("❌ Kendinle düello yapamazsın.")
      if (bet > balances[userId]) return await interaction.reply("❌ Yeterli paran yok.")
      initUser(tId)
      if (bet > balances[tId]) return await interaction.reply("❌ " + getName(tId) + " bu bahisi karşılayamaz (" + fmt(balances[tId]) + " 💵).")
      duelRequests[tId] = { challenger: userId, bet: bet, expiresAt: Date.now() + 60000 }
      return await interaction.reply("⚔️ DÜELLO İSTEĞİ\n\n" + username + " → " + getName(tId) + "\n💰 Bahis: " + fmt(bet) + " 💵\n⏱️ 60 saniye\n\n/kabul veya /reddet")
    }

    if (cmd === "kabul") {
      var duel = duelRequests[userId]
      if (!duel) return await interaction.reply("⚔️ Aktif bir düello isteğin yok.")
      if (Date.now() > duel.expiresAt) { delete duelRequests[userId]; return await interaction.reply("❌ Düello süresi doldu.") }
      if (balances[userId] < duel.bet) { delete duelRequests[userId]; return await interaction.reply("❌ Yeterli paran yok.") }
      if (balances[duel.challenger] < duel.bet) { delete duelRequests[userId]; return await interaction.reply("❌ Rakibinin parası yok.") }
      var winP = 0.5 + (hasItem(duel.challenger, "bilek") ? 0.1 : 0) - (hasItem(userId, "bilek") ? 0.1 : 0)
      removeMoney(userId, duel.bet); removeMoney(duel.challenger, duel.bet)
      var winnerId = Math.random() < winP ? duel.challenger : userId
      var prize = duel.bet * 2
      addMoney(winnerId, prize)
      if (winnerId === userId) { stats[userId].wins++; if (stats[duel.challenger]) stats[duel.challenger].losses++ }
      else { if (stats[duel.challenger]) stats[duel.challenger].wins++; stats[userId].losses++ }
      delete duelRequests[userId]
      return await interaction.reply("⚔️ DÜELLO SONUCU\n\n🏆 Kazanan: " + getName(winnerId) + "\n💰 Ödül: " + fmt(prize) + " 💵")
    }

    if (cmd === "reddet") {
      if (!duelRequests[userId]) return await interaction.reply("⚔️ Reddedecek bir düello isteğin yok.")
      delete duelRequests[userId]; return await interaction.reply("❌ Düello isteği reddedildi.")
    }

    if (cmd === "evlen") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      if (tId === userId) return await interaction.reply("❌ Kendinle evlenemezsin.")
      if (married[userId]) return await interaction.reply("❌ Zaten evlisin!")
      marryRequests[tId] = { from: userId, expiresAt: Date.now() + 120000 }
      return await interaction.reply("💍 Evlilik Teklifi\n\n" + username + " → " + getName(tId) + "\n⏱️ 2 dakika\n\n/evlenkabul")
    }

    if (cmd === "evlenkabul") {
      var req = marryRequests[userId]
      if (!req) return await interaction.reply("💍 Sana gönderilmiş evlilik teklifi yok.")
      if (Date.now() > req.expiresAt) { delete marryRequests[userId]; return await interaction.reply("❌ Teklifin süresi doldu.") }
      if (married[userId]) return await interaction.reply("❌ Zaten evlisin.")
      if (married[req.from]) { delete marryRequests[userId]; return await interaction.reply("❌ Teklifte bulunan kişi artık evli.") }
      married[userId] = req.from; married[req.from] = userId; delete marryRequests[userId]
      return await interaction.reply("💒 Tebrikler!\n\n" + getName(req.from) + " ve " + username + " evlendi! 🎊")
    }

    if (cmd === "bosan") {
      if (!married[userId]) return await interaction.reply("❌ Evli değilsin.")
      var pid = married[userId], pname = getName(pid)
      delete married[userId]; delete married[pid]
      return await interaction.reply("💔 Boşandın.\n" + pname + " ile ilişkin sona erdi.")
    }

    if (cmd === "envanter") {
      var tId = resolveUser(interaction, "kullanici") || userId
      var inv = inventories[tId] || []
      if (!inv.length) return await interaction.reply("🎒 " + getName(tId) + " envanteri boş.")
      var counts = {}
      for (var i = 0; i < inv.length; i++) counts[inv[i]] = (counts[inv[i]] || 0) + 1
      return await interaction.reply("🎒 " + getName(tId) + " Envanteri\n\n" + Object.keys(counts).map(function(item) { return counts[item] > 1 ? item + " ×" + counts[item] : item }).join("\n"))
    }

    if (cmd === "hediye") {
      var tId = resolveUser(interaction, "hedef")
      if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var itemName = getStr(interaction, "esya")
      if (!itemName) return await interaction.reply("❌ Eşya adı belirtmelisin.")
      if (tId === userId) return await interaction.reply("❌ Kendine hediye veremezsin.")
      var idx = inventories[userId].indexOf(itemName)
      if (idx === -1) return await interaction.reply("❌ Bu eşya envanterende yok.")
      inventories[userId].splice(idx, 1); initUser(tId); inventories[tId].push(itemName)
      return await interaction.reply("🎁 " + itemName + " → " + getName(tId) + " kullanıcısına hediye edildi!")
    }

    if (cmd === "play") {
      if (!serverId) return await interaction.reply("❌ Bu komut sadece sunucularda kullanılabilir.")

      var url = getStr(interaction, "url")
      if (!url) return await interaction.reply("❌ URL girmelisin.")

      var userVoiceChannel = userChannels[userId]
      if (!userVoiceChannel) {
        return await interaction.reply("❌ Önce bir ses kanalına gir, sonra /play kullan.")
      }

      if (!voiceQueues[serverId]) voiceQueues[serverId] = { items: [], playing: false, history: [], currentTitle: null, currentPlayer: null }
      var queue = voiceQueues[serverId]

      var isYouTube = url.includes("youtube.com") || url.includes("youtu.be")
      if (!isYouTube) {
        return await interaction.reply("❌ Sadece YouTube bağlantıları desteklenmektedir.\n\nÖrnek: https://www.youtube.com/watch?v=...")
      }

      queue.items.push({ url: url, requestedBy: username })

      if (!voiceConns[serverId]) {
        await interaction.reply("🔊 Ses kanalına bağlanılıyor...")
        try {
          var conn = new VoiceConnection(client, { channelId: userVoiceChannel, serverId: serverId })
          await conn.connect()
          voiceConns[serverId] = conn
          await interaction.followUp("✅ Bağlandı!\n\n🎵 Yükleniyor: " + url + "\n👤 İsteyen: " + username)
          streamWithPlayDL(serverId, queue.items[0])
        } catch (e) {
          delete voiceConns[serverId]
          queue.items.pop()
          return await interaction.followUp("❌ Ses kanalına bağlanılamadı: " + e.message)
        }
      } else {
        if (queue.playing) {
          return await interaction.reply("📋 Kuyruğa eklendi!\n\n🎵 " + url + "\n👤 " + username + "\n📍 Sıra: " + queue.items.length)
        } else {
          await interaction.reply("🎵 Yükleniyor: " + url)
          streamWithPlayDL(serverId, queue.items[0])
        }
      }
      return
    }

    if (cmd === "nowplaying") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var queue = voiceQueues[serverId]
      if (!queue || !queue.playing || !queue.currentTitle) return await interaction.reply("❌ Şu an çalan bir şarkı yok.")
      return await interaction.reply("🎵 Şu an çalıyor:\n\n" + queue.currentTitle + "\n\n📋 Kuyrukta: " + (queue.items.length - 1) + " şarkı daha")
    }

    if (cmd === "skip") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var queue = voiceQueues[serverId]
      if (!queue || !queue.playing) return await interaction.reply("❌ Şu an çalan bir şarkı yok.")
      if (queue.currentPlayer) { try { queue.currentPlayer.stop() } catch(e) {} }
      queue.items.shift(); queue.playing = false; queue.currentTitle = null
      if (queue.items.length > 0) {
        await interaction.reply("⏭️ Geçildi! Sıradaki: " + (queue.items[0].url))
        streamWithPlayDL(serverId, queue.items[0])
      } else {
        await interaction.reply("⏭️ Geçildi! Kuyruk bitti.")
      }
      return
    }

    if (cmd === "pause") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn = voiceConns[serverId]
      if (!conn) return await interaction.reply("❌ Bot ses kanalında değil.")
      var queue = voiceQueues[serverId]
      if (!queue || !queue.playing) return await interaction.reply("❌ Şu an çalan bir şarkı yok.")
      conn.pause(); return await interaction.reply("⏸️ Müzik duraklatıldı.")
    }

    if (cmd === "resume") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn = voiceConns[serverId]
      if (!conn) return await interaction.reply("❌ Bot ses kanalında değil.")
      conn.resume(); return await interaction.reply("▶️ Müzik devam ediyor.")
    }

    if (cmd === "stop") {
      if (!serverId) return await interaction.reply("❌ Sunucuda kullanılabilir.")
      var conn = voiceConns[serverId], queue = voiceQueues[serverId]
      if (!conn) return await interaction.reply("❌ Bot zaten ses kanalında değil.")
      if (queue && queue.currentPlayer) { try { queue.currentPlayer.stop() } catch(e) {} }
      try { conn.stopPlayer() } catch(e) {}
      try { await conn.disconnect() } catch(e) {}
      delete voiceConns[serverId]
      if (queue) { queue.items = []; queue.playing = false; queue.currentTitle = null; queue.currentPlayer = null }
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
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var amount = getInt(interaction, "miktar"); if (amount === null) return await interaction.reply("❌ Miktar belirtmelisin.")
      initUser(tId)
      if (amount >= 0) { addMoney(tId, amount); return await interaction.reply("✅ " + getName(tId) + " → +" + fmt(amount) + " 💵") }
      else { removeMoney(tId, Math.abs(amount)); return await interaction.reply("✅ " + getName(tId) + " → -" + fmt(Math.abs(amount)) + " 💵") }
    }

    if (cmd === "admin-rol") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var rol = getStr(interaction, "rol"); if (!rol) return await interaction.reply("❌ Rol adı belirtmelisin.")
      initUser(tId); levels[tId].role = rol
      return await interaction.reply("✅ " + getName(tId) + " → Unvan: " + rol)
    }

    if (cmd === "admin-seviye") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var seviye = getInt(interaction, "seviye"); if (!seviye || seviye <= 0) return await interaction.reply("❌ Geçerli seviye gir.")
      initUser(tId); levels[tId].level = seviye; levels[tId].xp = 0
      if (levelRoles[seviye]) levels[tId].role = levelRoles[seviye]
      return await interaction.reply("✅ " + getName(tId) + " → Seviye " + seviye)
    }

    if (cmd === "admin-ban") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      banned.add(tId); return await interaction.reply("🔨 " + getName(tId) + " bottan banlandı.")
    }

    if (cmd === "admin-unban") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      banned.delete(tId); return await interaction.reply("✅ " + getName(tId) + " banı kaldırıldı.")
    }

    if (cmd === "admin-warn") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      warnings[tId] = (warnings[tId] || 0) + 1
      if (warnings[tId] >= 3) { banned.add(tId); return await interaction.reply("🔨 " + getName(tId) + " 3 uyarıya ulaştı → banlandı.") }
      return await interaction.reply("⚠️ " + getName(tId) + " uyarıldı. (" + warnings[tId] + "/3)")
    }

    if (cmd === "admin-sifirla") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var tId = resolveUser(interaction, "hedef"); if (!tId) return await interaction.reply("❌ Geçersiz kullanıcı.")
      var tName = getName(tId)
      delete balances[tId]; delete levels[tId]; delete inventories[tId]; delete stats[tId]; delete warnings[tId]
      return await interaction.reply("🔄 " + tName + " verisi sıfırlandı.")
    }

    if (cmd === "admin-duyuru") {
      if (!isAdmin(userId)) return await interaction.reply("❌ Yetkin yok.")
      var mesaj = getStr(interaction, "mesaj"); if (!mesaj) return await interaction.reply("❌ Duyuru metni belirtmelisin.")
      announcements.push({ mesaj: mesaj, tarih: Date.now(), gonderildi: new Set() })
      return await interaction.reply("📢 Duyuru kaydedildi.")
    }

  } catch (err) {
    console.error("[INTERACTION HATA]", err)
    try { await interaction.reply("❌ Bir hata oluştu: " + err.message) } catch(e) {}
  }
})

client.on(Events.MessageCreate, async function(message) {
  try {
    if (!message || !message.content) return
    if (message.webhookId) return
    var userId = message.userId, username = message.user && message.user.username ? message.user.username : "Kullanici"
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
        levels[userId].xp = 0; levels[userId].level++
        var newRole = levelRoles[levels[userId].level]
        if (newRole) levels[userId].role = newRole
        var bonus = levels[userId].level * 50
        addMoney(userId, bonus)
        var msg = "🎉 SEVİYE ATLADIN!\n📈 Yeni Level: " + levels[userId].level
        if (newRole) msg += "\n🏅 Yeni Rol: " + newRole
        msg += "\n🎁 Bonus: +" + fmt(bonus) + " 💵"
        await message.reply(msg)
      }
    }
  } catch(err) { console.error("[MESAJ HATA]", err) }
})

client.login(TOKEN)
