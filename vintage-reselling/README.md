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

## Öffentlicher Vinted-Import
STOCKROOM liest ausschließlich öffentliche Angebotsseiten von `vinted.de`. Es werden keine Vinted-Logins, Cookies oder privaten Kontodaten verwendet. Der Import nutzt Ujeebu als externen Abrufdienst; die Angebots-URL wird an diesen Dienst übermittelt. Der Anbieter benötigt einen API-Key und berechnet Credits pro erfolgreichem Abruf (JavaScript-Rendering: laut Dokumentation 5 Credits pro Anfrage). Prüfe vor der Nutzung die aktuellen Tarife und nutze keine kostenpflichtige Aufladung ohne Zustimmung eines Erziehungsberechtigten.

### Einmalige Einrichtung
1. Einen Ujeebu-API-Key über das eigene Konto erstellen. Den Key niemals in GitHub, in den Website-Code oder in einen Chat kopieren.
2. In Supabase unter **Edge Functions** eine Funktion mit dem Namen `vinted-import` anlegen.
3. Den Inhalt von `supabase/functions/vinted-import/index.ts` in die Funktion übernehmen und deployen.
4. In Supabase unter **Edge Functions → Secrets** den Secret-Namen `UJEEBU_API_KEY` mit dem API-Key anlegen.
5. Die Funktion muss JWT-Prüfung aktiviert haben. Sie akzeptiert nur angemeldete STOCKROOM-Benutzer und öffentliche Vinted-Links von `vinted.de`.

Der Import versucht Titel, Marke, Kategorie, Größe, Preis, Beschreibung und mehrere Produktbilder zu erkennen. Vinted kann einzelne Felder auf öffentlichen Seiten auslassen; fehlende Angaben werden angezeigt und können manuell ergänzt werden. Es wird keine CAPTCHA-Lösung oder Anmeldung verwendet.

### Datenbank aktualisieren
Bei einer bereits eingerichteten Supabase-Datenbank einmalig im **SQL Editor** ausführen:

```sql
alter table public.products add column if not exists vinted_url text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.sales add column if not exists sale_channel text not null default 'Sonstig';
notify pgrst, 'reload schema';
```

Neue Datenbankprojekte erhalten diese Spalten bereits durch `schema.sql`.
