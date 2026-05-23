<p align="center">
  <img src="https://raw.githubusercontent.com/MertTunaGuralp/MeetyBot/main/assets/meetybot-logo.png" width="110" alt="MeetyBot Logo">
</p>

<h1 align="center">MeetyBot</h1>
<p align="center">
  <b>Wecordy platformu için SafakiGamer tarafından geliştirilmiş profesyonel açık kaynak bot.</b><br>
  <i>Toplantı yönetimi, eğlence, oyunlar ve daha fazlası!</i>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/MertTunaGuralp/MeetyBot?style=for-the-badge&color=gold">
  <img src="https://img.shields.io/badge/platform-Wecordy-blueviolet?style=for-the-badge">
  <img src="https://img.shields.io/github/languages/top/MertTunaGuralp/MeetyBot?color=41B883&style=for-the-badge">
  <img src="https://img.shields.io/github/license/MertTunaGuralp/MeetyBot?color=23d160&style=for-the-badge">
  <img src="https://img.shields.io/badge/developer-SafakiGamer-success?style=for-the-badge">
</p>

---

## 🚀 Hızlı Kurulum

Aşağıdaki adımları terminalde uygulayın:

### 1. Node.js Kurulumu

Projeyi çalıştırmak için [Node.js](https://nodejs.org/) (v16 veya üzeri) gereklidir.  
Kurulu değilse önce şunu çalıştırın:

```bash
# Ubuntu/Debian tabanlı için:
sudo apt update
sudo apt install nodejs npm
# Alternatif olarak resmi site üzerinden de kurabilirsiniz.
```

### 2. Depoyu Klonlayın

```bash
git clone https://github.com/MertTunaGuralp/MeetyBot.git
cd MeetyBot
```

### 3. Bağımlılıkları Yükleyin

```bash
npm install
```

### 4. Yapılandırma Dosyasını Oluşturun

`config.json` dosyası oluşturup Wecordy bot anahtarınızı ve tercihen ön ekinizi (prefix) girin:

```json
{
  "wecordy_token": "BURAYA_WECORDY_TOKENINIZI_YAZIN",
  "prefix": "/"
}
```

> NOT: API anahtarınızı asla kimseyle paylaşmayın!

Gerekirse örnek dosya kopyalayın:
```bash
cp config.example.json config.json
```

### 5. Uygulamayı Başlatın

```bash
npm start
# veya doğrudan:
node index.js
```
Başarıyla başlatınca terminalde şuna benzer bir çıktı görürsünüz:
```
=================================
🚀 WECORDY ULTRA BOT v5 AKTİF
=================================
✅ 50 slash komutu kaydedildi
```

---

## 🗂️ Veri Depolama (BETA)

- Tüm kullanıcı, envanter ve oyun verileri `database.sqlite` dosyasında güvende tutulur.
- Veritabanı oluşturmak için ekstra bir işlem yapmanıza gerek yoktur, bot ilk çalıştırmada otomatik oluşturur.
- DATABASE SİSTEMİ DENENMEDİ HATA VAR İSE GERİ BİLDİRİM YAPINIZ
---

## 🧩 Önemli Bağımlılıklar

- [@wecordy/core](https://www.npmjs.com/package/@wecordy/core) – Bot altyapısı & API erişimi
- better-sqlite3 – Hızlı, senkron SQLite veritabanı

Proje kök dizininde `package.json` üzerinden detaylı bağımlılık listesine bakabilirsiniz.

---

## 🏆 Başlıca Özellikler

- Slash komutlarla kolay toplantı & eğlence yönetimi
- Seviye sistemi, mini oyunlar, alışveriş ve ekonomi
- Yetkili işlemleri: ban, uyarı, para/rol düzenleme
- Otomasyon & duyurular
- AI destekli sohbet komutu (Anthropic Claude API ile)

---

## 💡 SSS

- **Wecordy için mi?**  
  Evet, yalnızca Wecordy altyapısına uygundur. Farklı platformlarda çalışmaz.

- **Veritabanı klasörü otomatik mi?**  
  Evet, `database.sqlite` dosyası ilk açılışta otomatik oluşur.

- **AI anahtarını nasıl eklerim?**  
  `index.js` içinde `AI_KEY` değişkenine kendi API anahtarınızı girin.

---

## 🤝 Katkı & Geri Bildirim

Her türlü katkı, fikir veya hata bildirimi için yeni issue/pull request açabilirsiniz.  
Daha kapsamlı katkı rehberi için `CONTRIBUTING.md` dosyasını inceleyin.

---

## 📝 Lisans

Bu proje [MIT Lisansı](LICENSE) ile açık kaynaktır.

<p align="center"><b><a href="https://github.com/SafakiGamer">SafakiGamer</a> / MeetyBot • Güçlü Wecordy bot deneyimi için profesyonel çözüm</b></p>
