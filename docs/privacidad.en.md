> 🇬🇧 English · 🇨🇱 [Español](privacidad.es.md)

# Personal data handling · PuduHealth

PuduHealth handles health data, which is sensitive data. This document explains what data each
part of the project uses, where it is stored, how it is protected, how long it is kept and what
the person can do with it.

## 1. Principles

| Principle | How it is applied |
|---|---|
| Privacy by design | Everything is computed and stored on the person's device. There is no server, no accounts and no analytics |
| Minimization | Only the values the rules use are stored. From the camera, only a number remains (heart rate and its variability), never an image |
| Purpose | The data is used to compare the person with themselves and tell them what to do. It is not used for anything else |
| Control by the person | They can view, export and delete their data at any time, and protect it with a PIN |
| Transparency | This document, the "How we handle your data" screen in the app and the open source code |
| Security | AES-GCM 256-bit encryption at rest; no transmission of personal data |

## 2. What data each part handles

| Part | Data | Where it stays |
|---|---|---|
| App, *My record* | Mood, sleepiness, hours of sleep, minutes of exercise, symptoms, temperature, and the measurements received through the API (sensors, devices, file import, camera adapter). Start date of the record | Only on the device, encrypted |
| App, platform API | Measurements sent by sensors or devices (`window.puduHealth`) or imported from a file, in the `puduhealth/v1` format | Only on the device, encrypted, like the check-ins |
| App, camera adapter | During the 60 s, the camera frames are processed in memory to obtain the average color of the fingertip. The frames are discarded immediately | Only the result is stored. "Download recording" gives the color signal to the person, and only if they ask for it |
| App, *example mission* | Simulated data of a fictional crew | Not stored |
| Pulsometro (pulse-meter tool, the team's study tool) | Fingertip color signal, heart rate, movement, optional perceived effort and times of each test, associated with a participant code (`P-XXXX`), never with a name | Team server, folder not accessible from the web. See section 7 |
| Public datasets (WESAD, PMData, Welltory) | Research data already de-identified by their authors | Not stored in the repository: the scripts download them from their source |

## 3. Storage and encryption on the device

The app's personal data is encrypted before it is written to the browser's storage
(`app/js/cifrado.js`, Web Crypto, no external dependencies).

- **Data key:** AES-GCM, 256 bits. Each write uses a new 96-bit initialization vector. GCM also
  authenticates: tampered data does not decrypt.
- **The data key is never stored in the clear.** It is stored wrapped (encrypted) by:
  - **a device key**, a non-exportable AES-GCM key, created in the browser itself and stored in
    IndexedDB. The page code can use it, but cannot read it or copy it out; or
  - **a key derived from the PIN** (optional), with PBKDF2-SHA-256, 600,000 iterations and a random
    128-bit salt. Without the PIN there is no way to open the data.
- **What is encrypted:** the *My record* entries and the camera baseline.
- **What is not encrypted, because it is not health data:** the start date of the record, the mode
  (My record or example mission), the language, the color theme and whether the introduction has
  already been seen.
- If the browser does not allow encryption (for example, the page opened over HTTP on the local
  network), the app says so in Settings. The published version is always served over HTTPS.

## 4. Transmission

- **The app does not send personal data anywhere.** It only requests its own files from the
  server that delivers it (HTML, JavaScript, styles, icons, the typeface and a 1.6 KB model),
  always over HTTPS.
- It loads nothing from third parties: no external fonts, no analytics, no advertising.
- Offline mode (`app/sw.js`) stores only the app's files on the device, never the person's data.
- Exporting creates a file on the device itself. What the person does with it is their decision.

## 5. Retention and deletion

- The data stays on the device until the person deletes it.
- **Settings → My data → Delete my data** removes the records, the camera baseline and the key.
  Without the key, any encrypted copy that might remain is unreadable.
- Forgetting the PIN has only one way out: deleting the data and starting over. There is no
  "master key" and no recovery by the team.
- Clearing the site data from the browser has the same effect.

## 6. Rights of the person

| Right | How it is exercised |
|---|---|
| Access | Everything stored can be seen in the app: Today, Data and Trends |
| Rectification | Recording the same day again replaces the previous entry |
| Erasure | Delete my data, in Settings |
| Portability | Export my data, in the open format `puduhealth/v1` (JSON), which the app and other systems can import |
| Objection and withdrawal | Simply do not use the app or delete the data. In the pulsometro, by giving the participant code (section 7) |

## 7. Pulsometro: the team's study data

The pulsometro (`pulsometro/`) is the tool the team used to collect recordings to develop and
validate the camera-based heart rate measurement.

- **Pseudonymization:** each participant receives a random `P-XXXX` code on their phone. The name
  is neither requested nor stored. The server rejects any submission that includes a name.
- **Informed consent** before the first recording: what is recorded, for what purpose, where it is
  stored, for how long, that participation is voluntary and that deletion can be requested at any
  time. The version and date of the consent travel with each submission.
- **Storage:** JSON files on the team's server, in a folder blocked from the web (`.htaccess`).
  There is no way to read, list or delete data through the web: it is downloaded only over
  SFTP/SSH. In production, `forzar_https` (`pulsometro/config.php`) is enabled to accept
  submissions only over HTTPS, and there are limits against abuse per IP address and on total disk space.
- **Retention:** at most 12 months from collection, or sooner if the person asks.
- **Deletion on request:** the person gives their code and the team deletes their folder
  (`datos/P-XXXX/`).
- **Analysis:** results are published aggregated and de-identified (`ml/README.md`). The recordings
  are not published in the repository.
- When opened, the tool deletes from the phones any old record that had been saved with a name.

## 8. On a mission: how data would be shared with the medical officer

This is a product design and is **not built** in the prototype, which shares nothing.

- By default, the crew medical officer sees nothing.
- The person can authorize the officer to see **only the traffic light** (the five risk levels),
  not their answers or their values. The authorization can be withdrawn at any time.
- The clinical screen (for example, fever or depression screening) suggests contacting the medical
  officer, but the person decides whether to make contact.
- The exchange would take place inside the habitat, end-to-end encrypted and with a log of every
  access, without passing through Earth.

## 9. Reference framework

The design follows the principles of the rules on personal data and health data. **This document
is not a legal assessment.**

| Rule | What the design takes from it |
|---|---|
| Chile, Law 19.628 on the protection of private life | Health data is sensitive data |
| Chile, Law 21.719 on personal data protection (published 2024, in force from December 2026) | Consent, purpose, minimization, security and the rights of access, rectification, erasure, objection and portability |
| Chile, Law 20.584 on patients' rights and duties | Confidentiality of health information |
| European Union, General Data Protection Regulation (Articles 9 and 25) | Health data as a special category; data protection by design and by default |

On a real mission, the crew's medical data is also subject to the medical confidentiality rules of
each space agency. Keeping the data on the device and sharing only with permission is consistent
with that principle.

## 10. Known limitations

- **The exported file is not encrypted.** The app warns about this next to the button.
- **Without a PIN**, anyone using the unlocked phone can open the app and see the data.
- **A short PIN protects against casual access, not against a dedicated attack.** Someone who
  obtained a copy of the browser's storage could try 4-digit PINs one by one; the 600,000
  PBKDF2 iterations make this slower, but not impossible. For this reason up to 8 digits are
  accepted, and using 6 or more is advisable.
- The data key is in the browser's memory while the app is open.
- Encryption depends on Web Crypto and IndexedDB. If the browser does not offer them, the app
  warns and the data stays unencrypted on the device.
- This is a hackathon prototype: it is not a medical device and has not passed a security audit.
