# Nexavision Live Stage — entegrasyon planı

## Mevcut yapı ve teknik karar

- Site React 18, Vite 6 ve TypeScript kullanıyor.
- Yönetici oturumu mevcut API ile doğrulanıyor ve yönetim ekranı yalnızca geçerli yönetici belirteciyle açılıyor.
- Gerçek zamanlı sahne için `three`, `@react-three/fiber` ve `@react-three/drei` kullanılıyor. React tabanlı mevcut uygulamada sahne yaşam döngüsünü ve denetimleri aynı durum ağacında tutmak için React Three Fiber uygun seçimdir.
- İzleyiciler `/stage` üzerinden sahneyi izler. Bütün reji kontrolleri yalnızca doğrulanmış yönetici panelindeki **3D Canlı Sahne** sekmesindedir. Yayın durumu mevcut dönem için API'de tutulur; izleyici 600 ms aralıklarla yeni revizyonu alır.

## Blender → tarayıcı aktarımı

Kaynak dosya tarayıcıda doğrudan çalışamaz. `scripts/export-nexavision-stage.py`, kaynak `.blend` dosyasını değiştirmeden şu işlemleri yapar:

1. Açılışın tamamlandığı karede sahne geometrisini değerlendirir.
2. Blender'a özgü ışıkları, kameraları, ana kontrol nesnesini ve hacim nesnelerini dışarıda bırakır.
3. Eğrileri ve yazıları mesh'e çevirir; nesne ve koleksiyon adlarını GLB extras alanında korur.
4. Blender sürücülerini ve animasyonlarını çıkarır; davranışları web tarafında yeniden kurmak üzere modeli durağanlaştırır.
5. Materyalleri glTF uyumlu Principled materyallere indirger.
6. Draco sıkıştırmalı GLB üretir.

Yerel prototip modeli `apps/web/public/models/nexavision-aurora-r03.glb` dosyasındadır. Yaklaşık 4,5 MB boyutundadır ve orijinal R03 sahnesinin platformunu, sekiz yaprağını, ana ekranını, tavan elemanlarını, jüri adalarını ve boş tribünlerini içerir.

## Web tarafında yeniden kurulan davranışlar

- İlk yüklemede tam karartma.
- Yaklaşık 14 saniyelik tek seferlik, seyrek spot darbeleriyle başlayan kademeli açılış.
- Karart/sıfırla ve açılışı atlayan doğrudan açma.
- Ana ve vurgu rengi, hazır paletler ve genel dimmer.
- Ön, üst, zemin, jüri, tribün koltuk LED'leri ve sahne çizgileri için bağımsız aç/kapat ve parlaklık.
- Hareketli spotlar, yaprak LED dolaşımı, isteğe bağlı yaprak iç yüzeyi ve hafif WebGL sisi.
- Tribün LED'leri için isteğe bağlı Hawaii dalgası: uçtan uca yumuşak geçiş, 0,3–2× hız. Ortak başlangıç zamanı izleyicilere gönderilir; kapatılınca sabit aydınlatma, azaltılmış harekette sabit ışık kullanılır.
- Genel, çapraz ve jüri kameraları arasında varsayılan 2,4 saniyelik kesintisiz easing geçişi.
- Yerel MP4/WebM dosyasını sunucuya göndermeden `Object URL` ile 16:9 ana ekranda oynatma.
- Düşük/orta/yüksek kalite, yükleme göstergesi, azaltılmış hareket/parlama ve tam ekran.

## Performans yaklaşımı

- Blender'daki 107 gerçek ışık tarayıcıya taşınmadı; bunların yerine az sayıda mantıksal ışık grubu kullanılıyor.
- Varsayılan kalitede gerçek zamanlı gölge kapalıdır. Yüksek kalite yalnızca bir spot gölgesini etkinleştirir.
- DPR ve antialias kalite seviyesine göre değişir.
- Model Draco ile sıkıştırılmıştır. Durağan geometri aynı materyal gruplarıyla birleştirilir; yaprak LED animasyonları 24 fazlı materyal grubunu paylaşır. Koltuk şeritleri tek instanced mesh ile çizilir. Her koltuğa gerçek ışık eklenmez.
- Kumaş ve beton metalik olmaktan çıkarıldı; PMREM ortam yansımaları eklendi. Bunlar Blender ışık hesaplarının birebir aktarımı değildir.
- Blender hacimsel sisi birebir taşınmadı; tarayıcı dostu `FogExp2` yaklaşımı kullanıldı. Işık huzmesi ve bloom gibi pahalı post efektler bu ilk prototipte bilinçli olarak sınırlıdır.

## Geçici parçalar ve yayın öncesi işler

- Yönetici yerel video seçene kadar ana ekranda üretilmiş geçici bir Nexavision görseli kullanılıyor.
- Yerel dosya yalnızca admin önizlemesindedir, yüklenmez veya izleyicilere gönderilmez. R2 etkinleştirilmedi; şimdilik yalnızca sitede bulunan üç video yayın listesinde kullanılabilir. Yeni kamu videoları için barındırma ve kullanım hakları ayrıca kararlaştırılmalıdır.
- Draco decoder dosyaları yayın öncesinde aynı origin altında barındırılabilir; prototip Drei'nin standart decoder yükleyicisini kullanır.
- Masaüstü ve mobil gerçek cihazlarda GPU/bellek/FPS profili çıkarılmadan sabit FPS veya Blender ile birebir görüntü sözü verilmemelidir.
- Modelde görünür kalite kaybı olan parçalar tespit edilirse export quantization değerleri parça bazında yeniden ayarlanmalıdır.
- Canlı siteye yayın, yalnızca kullanıcı onayından sonra yapılmalıdır.

## Yerel doğrulama sırası

1. Yönetici olarak oturum aç ve **3D Canlı Sahne** sekmesini aç.
2. Karartma ekranını, **Doğrudan Aç** ve 14 saniyelik **Sahneyi Başlat** akışını dene.
3. Açılış sürerken kamera değiştir; cue ve videonun sıfırlanmadığını doğrula.
4. Işık gruplarını, paletleri, kalite seviyelerini ve azaltılmış hareket seçeneğini dene.
5. Yerel bir MP4 seç; dosyanın ağ isteği üretmeden oynadığını doğrula.
6. Tam ekran ve normal görünümü masaüstü ile en az bir düşük güçlü cihazda karşılaştır.

## Geçici yayın videosu akışı

1. Mevcut site videolarından seç → **Ön yüklemeyi başlat**. Yeni cue kimliği ve oynatma durumu kaydedilir, video dosyası kopyalanmaz.
2. Açık izleyici sayfaları videoyu tamamen tarayıcı belleğine alır ve Blob URL oluşturur. İndirilenler klasörüne dosya yazılmaz; tarayıcı kendi HTTP önbelleğini kullanabilir.
3. Her izleyicide kendi yüzde/hazır bilgisi görünür. Admin yüzdesi yalnızca admin cihazıdır; toplu hazır sayacı yoktur. Henüz sayfayı açmamış kullanıcı önceden yükleyemez.
4. **Yayında oynat** ortak başlangıç zamanını gönderir. Geç katılanlar yükledikten sonra mevcut konuma geçer. Kamera ve renk değişikliği videoyu yeniden indirmez.
5. Ses için tarayıcının gerektirdiği kullanıcı etkileşimi **Sesi / oynatmayı etkinleştir** ile alınır. Oynatma reddi veya çözücü hatası gösterilir.
6. **Yayından kaldır** cue'yu null yapar; izleyicilerde oynatma durur, fetch iptal edilir, video src temizlenir ve Blob URL serbest bırakılır. Kaynak site dosyaları ve diğer konuk/açılış akışları silinmez. Tarayıcının HTTP disk önbelleğini uzaktan silme iddiası yoktur.

Ana ekran, orijinal ekranın dünya koordinatlarında bağımsız UV düzlemi kullanır. Görüntü oranı korunur, video renklerine sahne paleti uygulanmaz. Eski ters konsept yazısı gizlenmiştir.

## Video takılmasına karşı oynatma denetimi

- Ortak zamanla senkronizasyon için sürekli `currentTime` ataması yapılmaz. Yalnızca yeni oynatma/duraklatma komutu, geç katılım veya açık toparlanma adımı konuma atlar. Küçük farklar %97–103 aralığında oynatma hızıyla yumuşakça düzeltilir.
- Video iki saniye ilerlemezse arayüz kare beklendiğini belirtir. On saniyelik takılmada aynı bellekteki Blob URL yeniden açılır; dosya tekrar indirilmez. Toparlanma iki denemeyle sınırlıdır, ardından kullanıcıya hata ve yeniden deneme sunulur.
- Tarayıcı oynatma izni istemişse otomatik toparlanma döngüsü çalışmaz; kullanıcı etkileşimi beklenir. Kaynak değişimi ve kaldırma eski asenkron oynatma işlemlerini geçersiz kılar.
- Sabit koltuk LED renkleri yalnızca renk/mod değiştiğinde GPU'ya gönderilir. Hawaii dalgası, geometri, çözünürlük, kalite seviyeleri, ışıklar ve gölgeler korunur.
- Regresyon testleri kesintisiz oynatma, geç katılım, takılan seek, sınırlı toparlanma, autoplay reddi, eski promise sonucu ve duraklatma/temizleme akışlarını kapsar. Bunlar gerçek cihaz performansı garantisi değildir.
