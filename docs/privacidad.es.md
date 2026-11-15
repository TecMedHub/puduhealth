> 🇬🇧 [English](privacidad.en.md) · 🇨🇱 Español

# Tratamiento de datos personales · PuduHealth

PuduHealth trata datos de salud, que son datos sensibles. Este documento explica qué datos usa
cada parte del proyecto, dónde se guardan, cómo se protegen, cuánto tiempo se conservan y qué
puede hacer la persona con ellos.

## 1. Principios

| Principio | Cómo se aplica |
|---|---|
| Privacidad desde el diseño | Todo se calcula y se guarda en el dispositivo de la persona. No hay servidor, cuentas ni analítica |
| Minimización | Sólo se guardan los valores que usan las reglas. De la cámara queda un número (frecuencia cardíaca y su variabilidad), nunca una imagen |
| Finalidad | Los datos sirven para comparar a la persona consigo misma y avisarle qué hacer. No se usan para nada más |
| Control de la persona | Puede ver, exportar y borrar sus datos en cualquier momento, y protegerlos con un PIN |
| Transparencia | Este documento, la pantalla "Cómo tratamos tus datos" de la app y el código abierto |
| Seguridad | Cifrado AES-GCM de 256 bits en reposo; ninguna transmisión de datos personales |

## 2. Qué datos trata cada parte

| Parte | Datos | Dónde quedan |
|---|---|---|
| App, *Mi registro* | Ánimo, somnolencia, horas de sueño, minutos de ejercicio, síntomas, temperatura, y las mediciones recibidas por la API (sensores, equipos, archivo importado, adaptador de la cámara). Fecha de inicio del registro | Sólo en el dispositivo, cifrados |
| App, API de la plataforma | Mediciones que envían sensores o equipos (`window.puduHealth`) o que se importan de un archivo, en el formato `puduhealth/v1` | Sólo en el dispositivo, cifradas, igual que los registros |
| App, adaptador de la cámara | Durante los 60 s se procesan los cuadros de la cámara en memoria para obtener el color promedio de la yema del dedo. Los cuadros se descartan en el momento | Se guarda sólo el resultado. "Descargar grabación" entrega la señal de color a la persona, y sólo si lo pide |
| App, *misión de ejemplo* | Datos simulados de una tripulación ficticia | No se guardan |
| Pulsómetro (herramienta de estudio del equipo) | Señal de color de la yema del dedo, frecuencia cardíaca, movimiento, esfuerzo percibido opcional y horas de cada prueba, asociados a un código de participante (`P-XXXX`), nunca a un nombre | Servidor del equipo, carpeta no accesible por la web. Ver sección 7 |
| Conjuntos de datos públicos (WESAD, PMData, Welltory) | Datos de investigación ya desidentificados por sus autores | No se guardan en el repositorio: los scripts los descargan de su fuente |

## 3. Almacenamiento y cifrado en el dispositivo

Los datos personales de la app se cifran antes de escribirse en el almacenamiento del navegador
(`app/js/cifrado.js`, Web Crypto, sin dependencias externas).

- **Llave de datos:** AES-GCM de 256 bits. Cada escritura usa un vector de inicialización nuevo
  de 96 bits. GCM además autentica: un dato alterado no se descifra.
- **La llave de datos nunca se guarda en claro.** Se guarda envuelta (cifrada) por:
  - **una llave del dispositivo**, AES-GCM no exportable, creada en el propio navegador y guardada
    en IndexedDB. El código de la página la puede usar, pero no leer ni copiar fuera; o
  - **una llave derivada del PIN** (opcional), con PBKDF2-SHA-256, 600 000 iteraciones y sal
    aleatoria de 128 bits. Sin el PIN no hay forma de abrir los datos.
- **Qué se cifra:** los registros de *Mi registro* y la línea base de la cámara.
- **Qué no se cifra, porque no son datos de salud:** la fecha de inicio del registro, el modo
  (Mi registro o misión de ejemplo), el idioma, el tema de color y si ya se vio la introducción.
- Si el navegador no permite cifrar (por ejemplo, la página abierta por HTTP en la red local), la
  app lo dice en Ajustes. La versión publicada se entrega siempre por HTTPS.

## 4. Transmisión

- **La app no envía datos personales a ninguna parte.** Sólo pide sus propios archivos al
  servidor que la entrega (HTML, JavaScript, estilos, íconos, la fuente tipográfica y un modelo de
  1,6 KB), siempre por HTTPS.
- No carga nada de terceros: ni fuentes externas, ni analítica, ni publicidad.
- El modo sin conexión (`app/sw.js`) guarda en el dispositivo sólo los archivos de la app, nunca
  datos de la persona.
- Exportar crea un archivo en el propio dispositivo. Qué hace con él la persona es decisión suya.

## 5. Conservación y borrado

- Los datos quedan en el dispositivo hasta que la persona los borra.
- **Ajustes → Mis datos → Borrar mis datos** elimina los registros, la línea base de la cámara y
  la llave. Sin la llave, cualquier copia cifrada que hubiera quedado es ilegible.
- Olvidar el PIN tiene una sola salida: borrar los datos y empezar de nuevo. No existe una "llave
  maestra" ni recuperación por parte del equipo.
- Borrar los datos del sitio desde el navegador tiene el mismo efecto.

## 6. Derechos de la persona

| Derecho | Cómo se ejerce |
|---|---|
| Acceso | Todo lo guardado se ve en la app: Hoy, Datos y Tendencias |
| Rectificación | Volver a registrar el mismo día reemplaza lo anterior |
| Supresión | Borrar mis datos, en Ajustes |
| Portabilidad | Exportar mis datos, en el formato abierto `puduhealth/v1` (JSON), que la app y otros sistemas pueden importar |
| Oposición y retiro | Basta con no usar la app o borrar los datos. En el pulsómetro, entregando el código de participante (sección 7) |

## 7. Pulsómetro: datos del estudio del equipo

El pulsómetro (`pulsometro/`) es la herramienta con que el equipo reunió grabaciones para
desarrollar y validar la medición de frecuencia cardíaca con la cámara.

- **Seudonimización:** cada participante recibe en su teléfono un código aleatorio `P-XXXX`. No
  se pide ni se guarda el nombre. El servidor rechaza cualquier envío que traiga un nombre.
- **Consentimiento informado** antes de la primera grabación: qué se registra, para qué, dónde se
  guarda, por cuánto tiempo, que participar es voluntario y que se puede pedir el borrado en
  cualquier momento. La versión y la fecha del consentimiento viajan con cada envío.
- **Almacenamiento:** archivos JSON en el servidor del equipo, en una carpeta bloqueada para la
  web (`.htaccess`). No existe ninguna forma de leer, listar ni borrar datos por la web: se
  descargan sólo por SFTP/SSH. En producción se activa `forzar_https` (`pulsometro/config.php`) para
  aceptar envíos sólo por HTTPS, y hay límites contra abuso por dirección IP y por espacio total en disco.
- **Conservación:** como máximo 12 meses desde la recolección, o antes si la persona lo pide.
- **Borrado a pedido:** la persona entrega su código y el equipo elimina su carpeta
  (`datos/P-XXXX/`).
- **Análisis:** los resultados se publican agregados y desidentificados (`ml/README.md`). Las
  grabaciones no se publican en el repositorio.
- La herramienta borra de los teléfonos, al abrirse, cualquier registro antiguo que se hubiera
  guardado con un nombre.

## 8. En una misión: cómo se compartiría con el oficial médico

Esto es diseño del producto y **no está construido** en el prototipo, que no comparte nada.

- Por omisión, el oficial médico de la tripulación no ve nada.
- La persona puede autorizar que vea **sólo el semáforo** (los cinco niveles de riesgo), no sus
  respuestas ni sus valores. La autorización se puede retirar en cualquier momento.
- La pantalla clínica (por ejemplo, fiebre o tamizaje de depresión) propone contactar al oficial
  médico, pero el contacto lo decide la persona.
- El intercambio ocurriría dentro del hábitat, cifrado de extremo a extremo y con registro de cada
  acceso, sin pasar por la Tierra.

## 9. Marco de referencia

El diseño sigue los principios de las normas sobre datos personales y datos de salud. **Este
documento no es una evaluación legal.**

| Norma | Qué toma el diseño |
|---|---|
| Chile, Ley 19.628 sobre protección de la vida privada | Los datos de salud son datos sensibles |
| Chile, Ley 21.719 de protección de datos personales (publicada en 2024, en vigor desde diciembre de 2026) | Consentimiento, finalidad, minimización, seguridad y derechos de acceso, rectificación, supresión, oposición y portabilidad |
| Chile, Ley 20.584 de derechos y deberes de los pacientes | Confidencialidad de la información de salud |
| Unión Europea, Reglamento General de Protección de Datos (artículos 9 y 25) | Datos de salud como categoría especial; protección de datos desde el diseño y por defecto |

En una misión real, los datos médicos de la tripulación quedan además sujetos a las reglas de
confidencialidad médica de cada agencia espacial. Guardar los datos en el dispositivo y compartir
sólo con permiso es coherente con ese principio.

## 10. Límites conocidos

- **El archivo exportado no va cifrado.** La app lo advierte al lado del botón.
- **Sin PIN**, quien use el teléfono desbloqueado puede abrir la app y ver los datos.
- **Un PIN corto protege del acceso casual, no de un ataque dedicado.** Quien obtuviera una copia
  del almacenamiento del navegador podría probar PIN de 4 dígitos uno por uno; las 600 000
  iteraciones de PBKDF2 lo hacen más lento, pero no imposible. Por eso se aceptan hasta 8 dígitos y
  conviene usar 6 o más.
- La llave de datos está en la memoria del navegador mientras la app está abierta.
- El cifrado depende de Web Crypto y de IndexedDB. Si el navegador no los ofrece, la app avisa y
  los datos quedan sin cifrar en el dispositivo.
- Es un prototipo de hackatón: no es un dispositivo médico ni pasó una auditoría de seguridad.
