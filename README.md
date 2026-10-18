# Pinpoint — kamera-rangefinder (eksperimentell PWA)

En **testbar første prototype**, ikke et ferdig måleinstrument. Dette er en HTTPS-basert iPhone-webapp med kamera, frys bilde, forstørrelse, manuell topp/bunn-markering, kamerakalibrering og estimering av avstand.

## Kom i gang

1. Pakk ut ZIP-filen. Legg alle filene i et offentlig eller privat GitHub-repository (rett i rotmappen).
2. Åpne **Settings → Pages → Build and deployment → Source → GitHub Actions**. Arbeidsflyten i `.github/workflows/pages.yml` kjører testene før publisering ved oppdatering av `main`. Ved første oppsett kan den startes fra **Actions → Test and deploy Pinpoint → Run workflow**. Se publisert adresse under **Settings → Pages**.
3. Åpne adressen i **Safari på iPhone**. Trykk Del → **Legg til på Hjem-skjerm** → bruk **Åpne som webapp** hvis valget vises → Legg til.
4. Start appen fra ikonet, trykk **Start kamera** og tillat kameratilgang.

Kamera krever HTTPS (eller localhost ved lokal utvikling). iPhone PWA kan spørre om kameratillatelse på nytt etter en oppstart. Hvis den installerte webappen får kamerafeil, test samme adresse direkte i Safari og noter iOS-/modellversjon.

## Slik tester du på golfbanen

1. Finn **samme type flaggstang** på en kjent avstand, for eksempel **30 meter som faktisk er målt opp med målebånd eller laser**. Ikke anta at et skilt, en oppgitt hullengde eller unøyaktig GPS gir korrekt kalibreringsavstand.
2. Velg **Kalibrer**, angi oppmålt distanse, sikt slik at hele flaggstangen er synlig, trykk **Frys bilde**.
3. Trykk **toppen** og deretter **bunnen** av stangen. Bruk + til å forstørre det fryste bildet ved behov. Dra i det forstørrede bildet for å flytte utsnittet. Trykk **Lagre kalibrering**.
4. Velg **Mål avstand**, fotografer en flaggstang med samme høyde og marker topp/bunn. Trykk **Beregn avstand**.
5. Sammenlikn på minst 10 kjente avstander (20–150 meter). Noter telefonmodell, iOS-versjon, vær, lys, faktiske avstander, app-resultat og forskjellen. Uten validering kan vi ikke påstå nøyaktighet.

## Hvordan formelen fungerer

Hvis stangen i referansebildet har høyde `p_ref` målt i brøkdel av bildehøyden, og stangen i målbildet har høyde `p_target`, blir estimatet:

`D_target = D_ref × p_ref / p_target`

Formelen forutsetter at flaggstengene har **samme reelle høyde**, og at kameraets brennvidde, optiske zoom, utsnitt og perspektiv forblir sammenliknbare. Den digitale forstørrelsen i appens fryste bilde endrer ikke måleresultatet; den gjør bare presis manuell markering lettere. Hvis kameraet endrer fysisk linse automatisk, eller iOS endrer optisk utsnitt, kan resultatet være misvisende uten at appen oppdager det.

**Ikke forvent laser-nøyaktighet.** En flaggstang langt unna kan ha bare noen få piksler i høyden. To piksler målefeil kan da gi svært store avvik. Angitt følsomhet er et illustrativt anslag, *ikke* en statistisk konfidensgrense. Vi har ikke validert nøyaktigheten i felt.

## Personvern

Kamerabilder tas og behandles lokalt i webappen. Ingen bilder sendes til en server. Kalibreringen lagres som numeriske data i `localStorage` på telefonen og kan slettes fra hjelpeseksjonen. Webappens statiske filer caches for rask lasting, men aktiv kameratilgang og tillatelser er avhengig av iOS.

## Videreutvikling

- Maskinlæring for automatisk flaggdeteksjon; målet kan ikke antas å finnes uten spesialtrenet modell og validering.
- Optisk telekamera/zoom når enheten faktisk eksponerer det gjennom nettleseren, med egen kalibrering per zoom/linse.
- Bildeoppløsning, flerframe-sampling og automatisk bildeoppretting.
- Hybrid med greenkoordinater, GPS som avstandskontroll, validering mot laseravstand og feilstats på banedata.
- Ekte iOS-app med Swift/AVFoundation/ARKit hvis PWA begrenser tilgang til relevante kamerafunksjoner.

## Filstruktur

`index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icons/` — ingen byggesteg, ingen ekstern Javascript og ingen backend.

## Lokal utvikling

Kjør fra prosjektmappen:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Åpne `http://localhost:4173` på Mac. iPhone trenger en publisert HTTPS-adresse for kameratilgang; Macens lokale HTTP-adresse er ikke nok.

Kjør de automatiserte testene med Node.js 22 eller nyere:

```sh
npm test
```

Ingen pakker må installeres. Testene kontrollerer kameraoppstart med simulert kamera, avstandsberegning, endret kameraoppsett og avgrensning av mellomlager. De bekrefter ikke støtte på en bestemt iPhone eller nøyaktighet i felt.

## Endringer i v0.1.1

- Hindrer parallelle kameraoppstarter og stopper forsinkede kamerastrømmer etter at siden forlates.
- Leser kamerainnstillingene ved fotografering og krever ny kalibrering ved oppdaget endring i kamera, zoom eller bildeformat.
- Avgrenser mellomlageret til Pinpoint. Andre appers mellomlagre slettes ikke.
- Tester og automatisk GitHub Pages-publisering er klargjort.

Nettleseren kan unnlate å rapportere zoom og fysisk linsebytte. Appen kan derfor ikke garantere samme optiske oppsett selv om kontrollene passerer. Se [utviklingsplanen](PLAN.md).

Teknisk grunnlag: [MDN om getSettings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings) og [GitHubs oppsett for Pages-arbeidsflyter](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
