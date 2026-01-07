# Blain Hydraulics - Proje & Üretim Takip Sistemi

Bu proje, hidrolik asansör projeleri için hesaplama, teklif hazırlama, üretim takibi ve raporlama sağlayan modern bir web uygulamasıdır. 

**Teknolojiler:**
- HTML5, CSS3 (Modern, Responsive)
- Vanilla JavaScript (ES6+)
- **Supabase** (Veritabanı ve Auth)

## Kurulum ve Çalıştırma

1. Bu projeyi indirin.
2. `supabase_setup.sql` dosyasındaki SQL komutlarını Supabase projenizde çalıştırarak veritabanı tablolarını oluşturun.
3. `db.js` dosyasındaki `supabaseUrl` ve `supabaseKey` alanlarını kendi projenizle güncelleyin (Eğer farklı bir proje kullanacaksanız).
4. `index.html` dosyasını bir tarayıcıda açın veya bir statik sunucu (Live Server vb.) ile çalıştırın.

## Özellikler

- **Proje Hesaplama:** Asansör verilerine göre silindir seçimi ve maliyet hesabı.
- **Proje Yönetimi:** Projeleri kaydetme, güncelleme, silme.
- **Admin Paneli:** Kullanıcı yönetimi.
- **Üretim Takibi (Kanban):** Sürükle bırak ile üretim aşamalarını yönetme.
- **İhtiyaç Raporu:** Üretimdeki projeler için malzeme ihtiyaç listesi.

## Dağıtım (Deploy)

Bu proje statik bir web sitesi olduğu için **Vercel**, **Netlify** veya **GitHub Pages** üzerinde kolayca yayınlanabilir.
