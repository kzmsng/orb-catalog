# orb-catalog

Orb için uzaktan güncellenebilir uygulama kataloğu. Orb bu repodaki
`catalog.json` dosyasını çeker; yeni uygulama eklemek için Orb'u yeniden
derlemeye gerek yoktur — buraya bir uygulama eklemek yeterli.

## Yapı

- **`catalog.json`** — tek dosya, tüm uygulamaların tanımı. Orb bunu
  `raw.githubusercontent.com` üzerinden indirir.
- **`scripts/validate-catalog.mjs`** — bağımlılıksız Node script'i; JSON
  geçerliliği, benzersiz id, zorunlu alanlar, `update` şeması ve daha
  fazlasını kontrol eder. `node scripts/validate-catalog.mjs` ile çalıştırın.
  `.github/workflows/validate.yml` bunu her push/PR'da otomatik çalıştırır.

## catalog.json formatı

```jsonc
{
  "schema": 1,               // format sürümü (Orb uyumluluk için okur)
  "updatedAt": "2026-07-02",
  "apps": [
    {
      "id": "adguardhome",           // benzersiz, container adı olarak da kullanılır
      "name": "AdGuard Home",
      "description": "…",
      "category": "Network",         // bkz. "Kategoriler" bölümü
      "icon": "Shield",              // Lucide ikon adı (şu an Orb UI'da tüketilmiyor; ileriye dönük alan)
      "defaultPort": "3030",
      "version": "1.0.0",            // bilgi amaçlı; Orb'un update tespiti bu alanı kullanmaz (bkz. "update alanı")
      "dockerCompose": "version: '3.8'\nservices:\n  …",
      "infoUrl": "https://…",        // opsiyonel
      "setupNote": "İlk kurulumda …", // opsiyonel; "İlk Kurulum" kutusunda gösterilir
      "type": "app",                 // opsiyonel; bkz. "type alanı" bölümü — yoksa "app" varsayılır
      "update": {                    // opsiyonel; bkz. "update alanı" bölümü
        "registry": { "image": "docker.n8n.io/n8nio/n8n" },
        "release": { "provider": "github_release", "repository": "n8n-io/n8n" }
      }
    }
  ]
}
```

## Kategoriler

`category` alanı şu değerlerden biri olmalı:

`Media`, `Utilities`, `Database`, `Network`, `Cloud`, `Security`,
`Automation`, `Productivity`, `Monitoring`, `Developer Tools`, `Storage`

(Not: ağ/networking için `Network` kullanılır — ayrı bir "Networking"
değeri yoktur, karışıklık olmasın diye tek isim korunmuştur.)

## type alanı (opsiyonel)

`type` bir girdinin **kullanıcı uygulaması** mı yoksa **altyapı servisi** mi
olduğunu belirtir:

- `"app"` (veya alan hiç yoksa) — normal, son kullanıcının "kur ve kullan"
  diye baktığı bir uygulama (Jellyfin, n8n, Gitea, ...).
- `"infrastructure"` — genel amaçlı, başka uygulamaların/servislerin üzerine
  kurulduğu bir bileşen (Redis, Traefik, Cloudflare Tunnel, Rclone). Bunlar
  hâlâ gerçek, kurulabilir catalog girdileridir — sadece bir "uygulama
  mağazası" listesinde normal uygulamalarla aynı öncelikte, aynı sırada
  gösterilmeleri gerekmeyebilir. Orb'un bu ayrımı UI'da nasıl kullanacağı
  ayrı bir konudur; bu alan sadece veriyi taşır.

`type` **hiçbir zaman** update authority veya kurulum yetkisiyle ilgili
değildir — sadece sunum/sınıflandırma amaçlıdır.

## update alanı (opsiyonel)

`update`, bir uygulamanın resmi imaj kimliğini ve (varsa) resmi sürüm
bilgisinin nereden okunacağını tanımlar. **Tamamen opsiyoneldir** — bu alanı
olmayan bir catalog girdisi tamamen geçerlidir ve Orb'un jenerik registry
tabanlı güncelleme tespitini (imaj adından registry/repository çözümü)
hiçbir şekilde bozmaz.

- `registry.image` — uygulamanın **resmi imaj kimliğidir** (registry +
  repository; tag YAZILMAZ). Orb bunu, çalışan container'ın gerçek imajıyla
  birebir eşleştirmek için kullanır — sadece eşleşirse aşağıdaki `release`
  bilgisi o dağıtıma bağlanır. Böylece bir topluluk fork'u veya kullanıcının
  kendi imajı, resmi uygulamanın sürüm bilgisini asla yanlışlıkla devralmaz.
- `release.provider` + `release.repository` (`github_release`) /
  `release.url` (`http_feed`) / `release.providerId` (`custom`) — resmi
  sürüm bilgisinin **kaynağını** tanımlar (ör. `github_release` +
  `n8n-io/n8n` → GitHub Releases API'sinden okunur). Bu sadece kullanıcıya
  gösterilecek ek, bilgilendirici bir sürüm numarasıdır. `release` sadece
  `registry` de tanımlıysa anlamlıdır — Orb, `registry.image` ile eşleşme
  doğrulanmadan `release` bilgisini asla hiçbir dağıtıma bağlamaz.
  **`custom` şu an Orb tarafında şema düzeyinde kabul edilir ama hiçbir veri
  çekmez** (bilerek — güvenlik nedeniyle arbitrary provider execution
  desteklenmiyor); bir `custom` girdisi eklemek zararsızdır ama şu an için
  işlevsizdir.
- Bir uygulamanın gerçek GitHub Releases'i yoksa, ya da yayınladığı tag'ler
  temiz bir `MAJOR.MINOR.PATCH` biçiminde değilse (ör. tarih bazlı etiketler),
  `release` **eklemeyin** — sadece `registry` yeterlidir. Orb bu durumda
  sürüm bilgisini göstermez ama registry digest karşılaştırmasıyla
  güncelleme tespiti yine çalışır.

**Bunlar update execution veya update authority DEĞİLDİR.** Bir güncellemenin
gerçekten mevcut olup olmadığına dair tek yetkili karar, Orb tarafında
çalışan registry digest karşılaştırmasıdır (Orb, imajın çalıştığı registry'yi
doğrudan sorgular). `release` bilgisi hiçbir zaman "güncelleme var" kararını
tek başına vermez ve `version` alanı da (yukarıda, güncelleme tespiti için
değil) bir yetki kaynağı değildir.

## Placeholder'lar (Orb kurulumda doldurur)

`dockerCompose` içinde şu değişkenler kullanılabilir; Orb kurulum anında
gerçek değerleriyle değiştirir:

- `${DOCKER_NETWORK}` → kullanıcının Docker ağı (ör. `dockernet`)
- `${USERDATA}` → uygulamanın kalıcı veri klasörü (host-mutlak yol,
  `<kök>/data/<id>`). Volume kaynaklarında bunu kullan.
- `${SERVER_DOMAIN}` → kullanıcının alan adı (proxy modunda)
- `${APP_ID}` → uygulamanın id'si

Bunların dışındaki `${...}` referansları (ör. bir API token'ı) Orb tarafından
DOLDURULMAZ — compose'da olduğu gibi kalır. Böyle bir değişken gerekiyorsa
(ör. Cloudflare Tunnel token'ı), `setupNote` ile kullanıcıyı kurulum sonrası
compose dosyasını elle düzenlemesi gerektiği konusunda açıkça uyarın.

## Yeni uygulama ekleme

1. `catalog.json` içindeki `apps` dizisine yeni bir nesne ekle.
2. Volume yollarını `${USERDATA}/...` ile ver (asla `./göreli` değil).
3. `version` alanını koy (bilgi amaçlı).
4. Mümkünse `update.registry.image` ekle — uygulamanın gerçek, resmi
   image identity'si olmalı (tahmin etmeyin; Docker Hub/GHCR/quay.io'da
   gerçekten var olduğunu doğrulayın). `dockerCompose`'daki `image:`
   satırıyla aynı registry+repository'i göstermeli.
5. Uygulamanın GitHub Releases'i varsa ve tag'leri temiz semver ise
   `update.release` ekleyin; yoksa eklemeyin.
6. `node scripts/validate-catalog.mjs` çalıştırıp temiz geçtiğini doğrulayın.
7. Commit + push. Orb sonraki çekişte yeni uygulamayı görür.
