# STOCKROOM – Vintage Reselling

## Live-Hosting
Diese App ist eine statische Website und kann über GitHub Pages gehostet werden.
Die gemeinsame Online-Datenbank läuft über Supabase.

1. In Supabase ein Projekt anlegen.
2. SQL Editor öffnen und den Inhalt von `schema.sql` vollständig ausführen.
3. Project Settings → API öffnen und Project URL sowie Publishable Key kopieren.
4. Website öffnen, auf „Verbindung einrichten“ klicken und beide Werte einfügen.
5. Für euch beide je ein Konto über „Konto erstellen“ anlegen. Bei Bedarf E-Mail-Bestätigung in Supabase Authentication konfigurieren.

## GitHub Pages
Im Repository unter Settings → Pages als Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen und speichern.
Die App liegt in `/vintage-reselling/` und ist danach unter
`https://kartoffelneutrum.github.io/vintage-reselling/` erreichbar.

## Sicherheit
Nur den Supabase Publishable/anon Key in der Website verwenden. Niemals den Secret Key oder Service-Role-Key veröffentlichen. Zugriff auf Lager und Verkäufe ist durch Row Level Security auf angemeldete Benutzer beschränkt. Bilder sind öffentlich abrufbar, daher keine privaten Bilder hochladen.

## Vinted (privates Konto)
Die App bietet keine direkte Vinted-Kontoanbindung. Hinterlege bei einem Artikel die öffentliche URL deines Angebots; der Link erscheint im Tab „Vinted-Angebote“. Beim Erfassen eines Verkaufs kannst du „Vinted“ als Verkaufskanal auswählen. Verkäufe und Bestände werden dadurch in STOCKROOM aktualisiert, aber nicht automatisch von Vinted importiert.

Bei einer bereits eingerichteten Supabase-Datenbank müssen die neuen Spalten einmalig ergänzt werden (Supabase → SQL Editor):

```sql
alter table public.products add column if not exists vinted_url text;
alter table public.sales add column if not exists sale_channel text not null default 'Sonstig';
notify pgrst, 'reload schema';
```
