# Pinpoint – videre utvikling

## Utgangspunkt

v0.1 bruker manuell markering av topp og bunn på en flaggstang. En kalibrering på kjent avstand gir et forhold mellom stangens bildestørrelse og avstand. Ingen modell gjenkjenner flagget automatisk, og appen bruker ikke laser eller GPS til målingen.

Eksempel: På 30 meter dekker stangen 20 % av bildehøyden. I neste bilde dekker den 5 %. Da anslår appen 30 × 20 / 5 = 120 meter. Dette forutsetter samme stanghøyde og optiske kameravinkel.

## Første gjennomgang og rettelser

- Kameraoppstart manglet låsing mot gjentatte trykk og opprydding av forsinkede tillatelser. Rettet i v0.1.1.
- Kamerametadata ble lagret ved oppstart, men ikke kontrollert ved måling. Oppdateres nå ved fotografering; kjente avvik stopper målingen.
- Endret bildeformat ga bare en advarsel etter et resultat. Krever nå ny kalibrering.
- Service worker slettet alle andre mellomlagre på samme domene. Avgrenset til eget mellomlager og filsett.
- Telekamera, faktisk optisk zoom og nøyaktighet er fremdeles uavklart og må undersøkes på brukerens iPhone.

## Prioritert rekkefølge

1. **Publisering og enhetstest.** Åpne HTTPS-versjonen på iPhone, test tillatelser, frys/marker/angre og start fra hjemskjermen. Noter iPhone-modell og iOS-versjon.
2. **Kartlegg kameraene.** Vis en liste over kameraer nettleseren eksponerer etter tillatelse. Undersøk `getCapabilities()` og `getSettings()` på den konkrete telefonen. Vis bare zoomkontroller som faktisk støttes. Ikke merk et kamera som telekamera uten å ha bekreftet det.
3. **Kalibrering per oppsett.** Lagre separate profiler for kamera, rapportert zoom og bildeformat. Vurder flere referanseavstander for å avdekke systematiske avvik.
4. **Feltmålinger.** Sammenlikn mot laser på flere avstander og gjenta markeringen. Registrer absolutt feil i meter og relativ feil i prosent. Ta med uskarpe bilder og mislykkede målinger.
5. **Presisjon før automatikk.** Evaluer bildeoppløsning, fokus og flere bilder. Automatisk flaggdeteksjon kommer etter at den manuelle metoden er målt og forstått.
6. **Teknologivalg etter enhetstesten.** Hvis nettleseren ikke gir nødvendig kamerakontroll, vurder en egen iPhone-app. Ikke lov presisjon på 100–250 meter før målinger underbygger det.

## Feltlogg

For hver måling: telefonmodell, iOS, kamera/zoom, kalibreringsavstand, flaggstangtype, lys, faktisk avstand, appens estimat, antall piksler og merknader. Bilder trenger ikke lastes opp.

## Kilder

- [MDN: kameraegenskaper som nettleseren rapporterer](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities)
- [MDN: gjeldende kamerainnstillinger og manglende egenskaper](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings)
- [GitHub: publisering med GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
