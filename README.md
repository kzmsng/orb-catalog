# orb-catalog

Orb için uzaktan güncellenebilir uygulama kataloğu. Orb bu repodaki
`catalog.json` dosyasını çeker; yeni uygulama eklemek için Orb'u yeniden
derlemeye gerek yoktur — buraya bir uygulama eklemek yeterli.

## Yapı

- **`catalog.json`** — tek dosya, tüm uygulamaların tanımı. Orb bunu
  `raw.githubusercontent.com` üzerinden indirir.

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
      "category": "Network",         // Media|Utilities|Database|Network|Cloud|Security
      "icon": "Shield",              // Lucide ikon adı
      "defaultPort": "3030",
      "version": "1.0.0",            // güncelleme tespiti için; app değişince artır
      "dockerCompose": "version: '3.8'\nservices:\n  …",
      "infoUrl": "https://…",        // opsiyonel
      "setupNote": "İlk kurulumda …" // opsiyonel; "İlk Kurulum" kutusunda gösterilir
    }
  ]
}
```

## Placeholder'lar (Orb kurulumda doldurur)

`dockerCompose` içinde şu değişkenler kullanılabilir; Orb kurulum anında
gerçek değerleriyle değiştirir:

- `${DOCKER_NETWORK}` → kullanıcının Docker ağı (ör. `dockernet`)
- `${USERDATA}` → uygulamanın kalıcı veri klasörü (host-mutlak yol,
  `<kök>/data/<id>`). Volume kaynaklarında bunu kullan.
- `${SERVER_DOMAIN}` → kullanıcının alan adı (proxy modunda)
- `${APP_ID}` → uygulamanın id'si

## Yeni uygulama ekleme

1. `catalog.json` içindeki `apps` dizisine yeni bir nesne ekle.
2. Volume yollarını `${USERDATA}/...` ile ver (asla `./göreli` değil).
3. `version` alanını koy. Sonradan tanımı güncellersen bu sürümü artır —
   Orb "güncelleme var" olarak gösterir.
4. Commit + push. Orb sonraki çekişte yeni uygulamayı görür.
