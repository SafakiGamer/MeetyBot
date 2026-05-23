<!-- Animated Banner -->
<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=36&pause=1000&color=1FE29A&center=true&vCenter=true&width=800&lines=Ho%C5%9Fgeldiniz!+MeetyBot;+Profesyonel+Wecordy+Botunuz!;Kolay%2C+Modern%2C+Dinamik+Discord+Bottur" alt="MeetyBot Banner" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/MertTunaGuralp/MeetyBot/main/assets/meetybot-logo.svg" width="80" alt="Logo" />
</p>

<h1 align="center">MeetyBot</h1>
<p align="center"><i>Açık kaynak, özelleştirilebilir ve profesyonel toplantı & moderasyon botu.<br>
<strong>SafakiGamer</strong> tarafından geliştirildi!</i></p>

<p align="center">
  <a href="https://github.com/MertTunaGuralp/MeetyBot/actions">
    <img src="https://img.shields.io/github/workflow/status/MertTunaGuralp/MeetyBot/CI?label=build&color=success&style=for-the-badge" alt="CI Status"/></a>
  <a href="https://github.com/MertTunaGuralp/MeetyBot/stargazers">
    <img src="https://img.shields.io/github/stars/MertTunaGuralp/MeetyBot?color=FFD600&style=for-the-badge" alt="Stars"/></a>
  <a href="https://github.com/MertTunaGuralp/MeetyBot/issues">
    <img src="https://img.shields.io/github/issues/MertTunaGuralp/MeetyBot?color=F77825&style=for-the-badge" alt="Issues"/></a>
  <img src="https://img.shields.io/github/languages/top/MertTunaGuralp/MeetyBot?color=41B883&style=for-the-badge" alt="Main Language">
  <img src="https://img.shields.io/github/license/MertTunaGuralp/MeetyBot?color=23d160&style=for-the-badge" alt="License">
</p>

---

## 🚦 Neden MeetyBot?

- **Her Seviyeden Topluluk İçin Uygun:** Wecordy ve Discord sunucularındaki toplantı ve etkinlik ihtiyacına doğrudan çözüm.
- **%100 Açık Kaynak & Geliştirilebilir:** Esnek ve modüler yapısı ile kolayca katkı sunabilir ve özelleştirebilirsiniz.
- **Kapsamlı Moderasyon & Eğlence Komutları:** Sadece bot değil, topluluk yönetimi için mükemmel asistan.
- **Aktif Geliştirici & Topluluk Desteği:** Sorularınız için topluluk desteği ve hızlı iletişim.

---

## ⚡ Başlarken

### 1. **Botu Klonlayın:**
```bash
git clone https://github.com/MertTunaGuralp/MeetyBot.git
cd MeetyBot
```

### 2. **Gereksinimleri Yükleyin:**
```bash
npm install
```

### 3. **Yapılandırma Dosyasını Oluşturun:**
`config.example.json` dosyasını `config.json` olarak kopyalayın ve düzenleyin:
```bash
cp config.example.json config.json
```
Gerekli alanı doldurun:

```json
{
  "token": "BURAYA_DISCORD_BOT_TOKENINIZI_YAZIN",
  "prefix": "!"
}
```
### 4. **Botu Başlatın:**
```bash
npm start
```

#### ✅ Alternatif Kurulum Yöntemleri
- Docker ile kurulum için [buraya tıklayın](#docker-kurulumu)
- Heroku/Glitch desteği için yakında!

---

## 🎯 Komutlar & Özellikler

| Komut       | Açıklama                         | Yetki   |
|:--          |:---------------------------------|:--------|
| `!toplanti` | Toplantı planla & düzenle        | Admin   |
| `!anket`    | Anket başlat, oy toplama         | Herkes  |
| `!uyarı`    | Uyarı, susturma gibi moderasyon  | Mod     |
| `!yardım`   | Tüm komutları sıralar            | Herkes  |

> Daha fazla komut ve ayrıntılı tanımlar için `!yardım` yazabilirsiniz!

---

## 🖥️ Kullanım Demoları

<p align="center">
  <img src="https://raw.githubusercontent.com/MertTunaGuralp/MeetyBot/main/assets/demo.gif" alt="Bot Demo" width="600">
</p>

---

## 🏗️ Mimari & Geliştirici Notları

```mermaid
graph TD;
    Kullanıcı[Discord Kullanıcıları] --> Bot;
    Bot --> Moderasyon;
    Bot --> ToplantıModülü(Meeting);
    Bot --> Eğlence;
    Bot -.-> Loglama;
```
> Modern, ölçeklenebilir ve eklentiye uygun TypeScript mimarisi!

---

## 🤖 Docker Kurulumu

```bash
docker build -t meetybot .
docker run -e TOKEN=YOUR_BOT_TOKEN -e PREFIX=! meetybot
```

---

## 💡 SSS

- **Neden tokenimi gizli tutmalıyım?**  
  Herkese açık oynamayın, aksi halde botunuza izinsiz kişiler erişebilir!

- **Geri bildirim/öneri iletebilir miyim?**  
  Evet! Issue açmanız veya Pull Request göndermeniz yeterli.

---

## 🌐 Topluluk & Destek

- 📬 Sorularınız için Discord Topluluğumuz: [Discord Davet Linkiniz]
- 📢 Yenilikler ve Duyurular için Github Watch/Star Ekleyin
- 🧑‍💻 Geliştirici: [SafakiGamer profilini ziyaret et](https://github.com/SafakiGamer)

---

## 🗺️ Yol Haritası

- [x] Temel toplantı ve moderasyon komutları
- [ ] Otomatik rol atama sistemi (Yakında!)
- [ ] Web panel entegrasyonu
- [ ] Çoklu dil desteği

---

## 🎁 Katkı Sağlamak

1. Fork'la ve geliştir (en son ana dalı almayı unutma)
2. Yeni bir branch'te çalış
3. Değişikliği commit'le, pushla ve PR aç
4. Açıklama ekle ve review al!

Daha detaylı katkı dökümanı için: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🙏 Teşekkür & Katkıda Bulunanlar

- SafakiGamer (Geliştirici ve yönetici)
- Tüm katkıcılarımıza teşekkürler!  
Katkıda bulunan olmak için PR gönderebilirsin!

---

## ⚖️ Lisans

> MIT License | © SafakiGamer & MeetyBot Contributors

<p align="center">
  <img src="https://forthebadge.com/images/badges/made-with-javascript.svg">
  <img src="https://forthebadge.com/images/badges/built-with-love.svg">
</p>
