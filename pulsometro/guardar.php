<?php
/*
 * Recibe una prueba terminada y la guarda como JSON.
 *
 * Sólo ESCRIBE: no existe ninguna forma de leer, listar ni borrar datos por la web.
 * Los archivos se descargan del servidor por SFTP/SSH.
 *
 * POST guardar.php   (Content-Type: application/json, cabecera X-Pulsometro: 1)
 * {
 *   "participante": "P-7KQ2", "sesion_id": "a1b2c3d4e5f6", "prueba": "trotar",
 *   "consentimiento": { "version": "1", "fecha": "2026-11-14T15:20:00.000Z" },
 *   "inicio_ms": 1763134200123, "fin_ms": 1763134800456, "completa": true,
 *   "origen": "camara" | "demo", "fps": 30.0,
 *   "muestras": [[t_s, timestamp_ms, r, g, b], ...],   t_s = segundos grabados (sin pausas)
 *   "fc":       [[timestamp_ms, fc_lpm|null, calidad|null], ...],
 *   "eventos":  [[timestamp_ms, "tipo"], ...],
 *   "borg":     { "valor": 6..20, "timestamp_ms": ... } | null     esfuerzo percibido (opcional)
 *   "movimiento": [[timestamp_ms, rms_m_s2|null], ...]   (opcional)
 * }
 */
declare(strict_types=1);
const METODOS_PERMITIDOS = ['POST'];
require __DIR__ . '/inc/datos.php';

const MAX_BYTES    = 6 * 1024 * 1024;
const MAX_MUESTRAS = 60000;  // 10 min a 60 fps + margen
const MAX_FC       = 2000;
const MAX_EVENTOS  = 500;
const TS_MIN       = 1577836800000;  // 2020-01-01
const TS_MAX       = 4102444800000;  // 2100-01-01
const EVENTOS      = ['inicio', 'fin', 'detenida', 'pantalla_oculta', 'pantalla_visible', 'dedo_retirado', 'dedo_apoyado', 'interrumpida', 'pausa', 'reanudada'];
// Hora real entre inicio y fin: incluye las pausas (se puede pausar una prueba y grabar otras entretanto).
const MAX_DURACION_REAL_S = 12 * 3600;

function responder(array $datos, int $codigo = 200): void
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fallar(string $mensaje, int $codigo = 400): void
{
    responder(['ok' => false, 'error' => $mensaje], $codigo);
}

function es_num($v): bool
{
    return (is_int($v) || is_float($v)) && is_finite((float) $v);
}

// ---------- 1. sólo desde la propia página ----------
// La cabecera propia + JSON obligan al navegador a pedir permiso (CORS) si otra web
// intenta enviar datos; como este servidor no lo concede, el envío se bloquea.
if (($_SERVER['HTTP_X_PULSOMETRO'] ?? '') !== '1') {
    fallar('Petición no permitida', 403);
}
if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    fallar('Se esperaba JSON', 415);
}
$origen = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origen !== '' && $origen !== 'null') {
    $hostOrigen = trim(strtolower((string) parse_url($origen, PHP_URL_HOST)), '[]');
    $hostSitio = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($hostOrigen === '' || $hostOrigen !== trim($hostSitio, '[]')) {
        fallar('Origen no permitido', 403);
    }
}

// ---------- 2. leer y validar ----------
$crudo = file_get_contents('php://input', false, null, 0, MAX_BYTES + 1);
if ($crudo === false || strlen($crudo) > MAX_BYTES) {
    fallar('La prueba es demasiado grande', 413);
}
$d = json_decode($crudo, true);
if (!is_array($d)) {
    fallar('JSON inválido');
}

// Nunca se aceptan nombres: los datos se vinculan sólo a un código de participante.
if (array_key_exists('nombre', $d)) {
    fallar('Este servicio no recibe nombres: use el código de participante');
}
$participante = is_string($d['participante'] ?? null) ? $d['participante'] : '';
if (!preg_match(PATRON_PARTICIPANTE, $participante)) {
    fallar('Código de participante inválido');
}

// consentimiento informado
$cons = $d['consentimiento'] ?? null;
if (!is_array($cons) || !is_string($cons['version'] ?? null) || !preg_match('/^[A-Za-z0-9._-]{1,16}$/', $cons['version'])) {
    fallar('Falta el consentimiento informado');
}
$consFecha = is_string($cons['fecha'] ?? null) ? strtotime($cons['fecha']) : false;
if ($consFecha === false || $consFecha < TS_MIN / 1000 || $consFecha > time() + 86400) {
    fallar('Fecha de consentimiento inválida');
}
$consentimiento = ['version' => $cons['version'], 'fecha' => date('c', $consFecha)];

$sesion = is_string($d['sesion_id'] ?? null) ? $d['sesion_id'] : '';
if (!preg_match('/^[a-f0-9]{12}$/', $sesion)) {
    fallar('Sesión inválida');
}

$codigo = is_string($d['prueba'] ?? null) ? $d['prueba'] : '';
if (!isset(PRUEBAS[$codigo])) {
    fallar('Prueba desconocida');
}
$prueba = PRUEBAS[$codigo];

$inicio = $d['inicio_ms'] ?? null;
$fin = $d['fin_ms'] ?? null;
if (!is_int($inicio) || !is_int($fin) || $inicio < TS_MIN || $fin > TS_MAX || $fin < $inicio
    || $fin - $inicio > MAX_DURACION_REAL_S * 1000) {
    fallar('Marcas de tiempo inválidas');
}
if (!is_bool($d['completa'] ?? null)) {
    fallar('Falta "completa"');
}
$origenDatos = in_array($d['origen'] ?? '', ['camara', 'demo'], true) ? $d['origen'] : null;
if ($origenDatos === null) {
    fallar('Origen de datos inválido');
}
$fps = es_num($d['fps'] ?? null) && $d['fps'] > 0 && $d['fps'] <= 240 ? round((float) $d['fps'], 1) : null;

// muestras [t_s, timestamp_ms, r, g, b]
if (!is_array($d['muestras'] ?? null) || !array_is_list_compat($d['muestras'])) {
    fallar('Faltan las muestras');
}
$n = count($d['muestras']);
if ($n < 30 || $n > MAX_MUESTRAS) {
    fallar('Cantidad de muestras fuera de rango');
}
$tMax = $prueba['duracion'] + 60;
$tAnt = -1.0;
$muestras = [];
foreach ($d['muestras'] as $m) {
    if (!is_array($m) || count($m) !== 5 || !array_is_list_compat($m)) fallar('Cada muestra debe ser [t, timestamp_ms, r, g, b]');
    foreach ($m as $v) {
        if (!es_num($v)) fallar('Valor no numérico en las muestras');
    }
    [$t, $ts, $r, $g, $b] = $m;
    if ($t < 0 || $t > $tMax || $t < $tAnt) fallar('Tiempos inválidos en las muestras');
    if ($ts < $inicio - 5000 || $ts > $fin + 5000) fallar('Timestamp de muestra fuera de la prueba');
    if ($r < 0 || $r > 255 || $g < 0 || $g > 255 || $b < 0 || $b > 255) fallar('Color fuera de rango (0–255)');
    $tAnt = (float) $t;
    $muestras[] = [round((float) $t, 3), (int) round((float) $ts), round((float) $r, 2), round((float) $g, 2), round((float) $b, 2)];
}

// FC por segundo [timestamp_ms, fc|null, calidad|null]
$fc = [];
foreach (is_array($d['fc'] ?? null) ? array_slice($d['fc'], 0, MAX_FC) : [] as $f) {
    if (!is_array($f) || count($f) !== 3 || !es_num($f[0] ?? null)) fallar('Serie de FC inválida');
    $ts = (int) round((float) $f[0]);
    $lpm = es_num($f[1]) && $f[1] >= 20 && $f[1] <= 260 ? round((float) $f[1], 1) : null;
    $cal = es_num($f[2]) && $f[2] >= 0 && $f[2] <= 100 ? (int) round((float) $f[2]) : null;
    if ($ts < $inicio - 5000 || $ts > $fin + 5000) fallar('Timestamp de FC fuera de la prueba');
    $fc[] = [$ts, $lpm, $cal];
}

// eventos [timestamp_ms, tipo]
$eventos = [];
foreach (is_array($d['eventos'] ?? null) ? array_slice($d['eventos'], 0, MAX_EVENTOS) : [] as $e) {
    if (!is_array($e) || count($e) !== 2 || !es_num($e[0] ?? null) || !in_array($e[1] ?? null, EVENTOS, true)) {
        fallar('Evento inválido');
    }
    $eventos[] = [(int) round((float) $e[0]), $e[1]];
}

// esfuerzo percibido (escala de Borg 6–20), preguntado al terminar la prueba; null = no respondió
$borg = null;
if (isset($d['borg'])) {
    $b = $d['borg'];
    $valor = is_array($b) ? ($b['valor'] ?? null) : null;
    $tsBorg = is_array($b) ? ($b['timestamp_ms'] ?? null) : null;
    if (!is_int($valor) || !isset(BORG[$valor]) || !is_int($tsBorg) || $tsBorg < $inicio || $tsBorg > TS_MAX) {
        fallar('Respuesta de la escala de Borg inválida');
    }
    $borg = [
        'escala'        => 'Borg RPE 6-20',
        'valor'         => $valor,
        'etiqueta'      => BORG_CORTO[$valor] ?? null,   // lo que decía el botón, ej. "Ligero +"
        'descripcion'   => borg_descripcion($valor),
        'respondido'    => iso_ms($tsBorg),
        'respondido_ms' => $tsBorg,
    ];
}
// movimiento por segundo [timestamp_ms, aceleración RMS m/s² | null] (opcional)
$movimiento = [];
foreach (is_array($d['movimiento'] ?? null) ? array_slice($d['movimiento'], 0, MAX_FC) : [] as $m) {
    if (!is_array($m) || count($m) !== 2 || !es_num($m[0] ?? null)) fallar('Serie de movimiento inválida');
    $ts = (int) round((float) $m[0]);
    if ($ts < $inicio - 5000 || $ts > $fin + 5000) fallar('Timestamp de movimiento fuera de la prueba');
    $movimiento[] = [$ts, es_num($m[1]) && $m[1] >= 0 && $m[1] <= 200 ? round((float) $m[1], 3) : null];
}
$umbralMovimiento = es_num($d['umbral_movimiento'] ?? null) && $d['umbral_movimiento'] > 0 && $d['umbral_movimiento'] < 50
    ? round((float) $d['umbral_movimiento'], 3) : null;

// ---------- 3. límites contra abuso ----------
$carpeta = carpeta_persona($participante);
$dir = dir_datos() . '/' . $carpeta;
if (!asegurar_dir($dir)) {
    error_log('pulsometro: no se puede escribir en ' . $dir);
    fallar('El servidor no puede escribir en la carpeta de datos', 500);
}
if (!limite_ip_ok()) {
    fallar('Demasiados guardados desde esta red. Intente en una hora.', 429);
}
if (espacio_usado() + strlen($crudo) > (int) (config('max_espacio_mb') ?: 2000) * 1024 * 1024) {
    error_log('pulsometro: se alcanzó max_espacio_mb');
    fallar('El servidor alcanzó su espacio máximo. Avise al equipo.', 507);
}

// ---------- 4. resumen calculado en el servidor ----------
$validas = array_values(array_filter($fc, fn($f) => $f[1] !== null && ($f[2] ?? 0) >= 40));
$lpms = array_column($validas, 1);
$resumen = [
    'fc_media_lpm'     => $lpms ? round(array_sum($lpms) / count($lpms), 1) : null,
    'fc_min_lpm'       => $lpms ? min($lpms) : null,
    'fc_max_lpm'       => $lpms ? max($lpms) : null,
    'segundos_con_fc'  => count($lpms),
    'calidad_media'    => $validas ? (int) round(array_sum(array_column($validas, 2)) / count($validas)) : null,
    'n_muestras'       => count($muestras),
];

// ---------- 5. escribir ----------
$archivo = date('Ymd-His', intdiv($inicio, 1000)) . '_' . $codigo . '_' . bin2hex(random_bytes(6)) . '.json';
$meta = [
    'formato'      => 'pulsometro-ppg/1',
    'participante' => ['codigo' => $participante, 'carpeta' => $carpeta],
    'consentimiento' => $consentimiento,
    'sesion_id'    => $sesion,
    'prueba'       => ['codigo' => $codigo, 'nombre' => $prueba['nombre'], 'duracion_objetivo_s' => $prueba['duracion']],
    'completa'     => $d['completa'],
    'borg'         => $borg,   // esfuerzo percibido (escala de Borg 6–20), null si no se respondió
    'origen'       => $origenDatos,
    'inicio'       => iso_ms($inicio),
    'inicio_ms'    => $inicio,
    'fin'          => iso_ms($fin),
    'fin_ms'       => $fin,
    'duracion_s'   => round(($fin - $inicio) / 1000, 3),
    'recibido'     => date('c'),
    'dispositivo'  => [
        'navegador' => mb_substr(strip_tags((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 300),
        'fps_medio' => $fps,
    ],
    'resumen'          => $resumen,
    'columnas_muestras' => ['t_s', 'timestamp_ms', 'r', 'g', 'b'],
    'columnas_fc'       => ['timestamp_ms', 'fc_lpm', 'calidad'],
    'columnas_eventos'  => ['timestamp_ms', 'tipo'],
    'columnas_movimiento' => ['timestamp_ms', 'aceleracion_rms_m_s2'],
    'umbral_movimiento' => $umbralMovimiento,
];

// JSON legible: metadatos con sangría y una fila por línea en las series (más compacto).
try {
    $j = fn($v) => json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    $filas = fn(array $a) => $a ? "[\n        " . implode(",\n        ", array_map($j, $a)) . "\n    ]" : '[]';
    $cabeza = json_encode($meta, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    $contenido = substr($cabeza, 0, -2)
        . ",\n    \"eventos\": " . $filas($eventos)
        . ",\n    \"fc\": " . $filas($fc)
        . ",\n    \"movimiento\": " . $filas($movimiento)
        . ",\n    \"muestras\": " . $filas($muestras)
        . "\n}\n";
} catch (JsonException $e) {
    fallar('No se pudo construir el JSON', 500);
}

if (!escribir_atomico($dir . '/' . $archivo, $contenido)) {
    error_log('pulsometro: no se pudo escribir ' . $dir . '/' . $archivo);
    fallar('No se pudo guardar en el servidor', 500);
}
responder(['ok' => true, 'archivo' => $carpeta . '/' . $archivo, 'resumen' => $resumen]);

/** array_is_list() existe desde PHP 8.1; esto funciona también en 7.4/8.0. */
function array_is_list_compat(array $a): bool
{
    $i = 0;
    foreach ($a as $k => $_) {
        if ($k !== $i++) {
            return false;
        }
    }
    return true;
}
