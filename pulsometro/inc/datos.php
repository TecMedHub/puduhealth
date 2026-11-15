<?php
/*
 * Protocolo de pruebas y almacenamiento de los JSON.
 * Estructura en disco:  <dir_datos>/<persona>/<AAAAMMDD-HHMMSS>_<prueba>_<código>.json
 */
declare(strict_types=1);
require_once __DIR__ . '/nucleo.php';

/** Protocolo: código => nombre visible y duración en segundos. */
const PRUEBAS = [
    'descanso'     => ['nombre' => 'Descanso',     'duracion' => 600],
    'trotar'       => ['nombre' => 'Trotar',       'duracion' => 600],
    'correr'       => ['nombre' => 'Correr',       'duracion' => 120],
    'recuperacion' => ['nombre' => 'Recuperación', 'duracion' => 600],
];

/**
 * Escala de Borg de esfuerzo percibido (RPE 6–20). Se pregunta al terminar cada prueba.
 * Los valores pares no tienen descripción en la escala original.
 */
const BORG = [
    6  => 'Sin esfuerzo',
    7  => 'Extremadamente ligero',
    8  => '',
    9  => 'Muy ligero',
    10 => '',
    11 => 'Ligero',
    12 => '',
    13 => 'Algo duro',
    14 => '',
    15 => 'Duro',
    16 => '',
    17 => 'Muy duro',
    18 => '',
    19 => 'Extremadamente duro',
    20 => 'Esfuerzo máximo',
];

/**
 * Etiquetas cortas para la grilla de la encuesta (pantalla de celular).
 * Los pares son intermedios: "Ligero +" = un poco más que Ligero, sin llegar a Algo duro.
 */
const BORG_CORTO = [
    6 => 'Nada',  7 => 'Extr. ligero', 8 => 'Extr. ligero +', 9 => 'Muy ligero', 10 => 'Muy ligero +',
    11 => 'Ligero', 12 => 'Ligero +', 13 => 'Algo duro', 14 => 'Algo duro +', 15 => 'Duro',
    16 => 'Duro +', 17 => 'Muy duro', 18 => 'Muy duro +', 19 => 'Extr. duro', 20 => 'Máximo',
];

/** Texto de un valor de Borg: el de la escala, o para los pares "Un poco más que «X», sin llegar a «Y»". */
function borg_descripcion(int $valor): string
{
    $texto = BORG[$valor] ?? '';
    if ($texto !== '' || !isset(BORG[$valor - 1], BORG[$valor + 1])) {
        return $texto;
    }
    return 'Un poco más que «' . BORG[$valor - 1] . '», sin llegar a «' . BORG[$valor + 1] . '»';
}

function dir_datos(): string
{
    $d = config('dir_datos');
    return rtrim(is_string($d) && $d !== '' ? $d : __DIR__ . '/../datos', '/');
}

/**
 * Crea la carpeta si falta y la deja protegida aunque alguien borre los archivos de protección:
 * .htaccess (Apache) e index.html vacío (evita listados si el servidor los permitiera).
 */
function asegurar_dir(string $dir): bool
{
    if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
        return false;
    }
    $raiz = dir_datos();
    if (!is_file($raiz . '/.htaccess')) {
        @file_put_contents($raiz . '/.htaccess',
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    if (!is_file($dir . '/index.html')) {
        @file_put_contents($dir . '/index.html', '');
    }
    return is_writable($dir);
}

/** Código de participante: "P-" y 4 caracteres sin ambiguos (sin 0, 1, I, L, O). */
const PATRON_PARTICIPANTE = '/^P-[A-HJ-NP-Z2-9]{4}$/';

/** Carpeta de un participante: es su propio código (sólo A-Z, 2-9 y "-": nunca sale de la carpeta de datos). */
function carpeta_persona(string $codigo): string
{
    if (!preg_match(PATRON_PARTICIPANTE, $codigo)) {
        throw new InvalidArgumentException('Código de participante inválido');
    }
    return $codigo;
}

/** Escritura atómica: archivo temporal + rename (nunca queda un JSON a medias). */
function escribir_atomico(string $ruta, string $contenido): bool
{
    $tmp = $ruta . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, $contenido, LOCK_EX) === false) {
        return false;
    }
    @chmod($tmp, 0660);
    if (!@rename($tmp, $ruta)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/** Límite de guardados por hora y por IP (la IP se guarda sólo como hash). */
function limite_ip_ok(): bool
{
    $max = (int) (config('max_guardados_por_hora_ip') ?: 300);
    $f = @fopen(dir_datos() . '/_limite.json', 'c+');
    if (!$f) {
        return true;  // sin archivo de control no se bloquea el guardado
    }
    flock($f, LOCK_EX);
    $datos = json_decode((string) stream_get_contents($f), true);
    $datos = is_array($datos) ? $datos : [];
    $ahora = time();
    foreach ($datos as $k => $v) {
        if (!is_array($v) || $ahora - (int) ($v[1] ?? 0) >= 3600) {
            unset($datos[$k]);
        }
    }
    $ip = hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $n = (int) ($datos[$ip][0] ?? 0);
    $ok = $n < $max;
    if ($ok) {
        $datos[$ip] = [$n + 1, $datos[$ip][1] ?? $ahora];
    }
    ftruncate($f, 0);
    rewind($f);
    fwrite($f, json_encode($datos));
    flock($f, LOCK_UN);
    fclose($f);
    return $ok;
}

/** Espacio total usado por la carpeta de datos (bytes). */
function espacio_usado(): int
{
    $total = 0;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(dir_datos(), FilesystemIterator::SKIP_DOTS)
    );
    foreach ($it as $archivo) {
        $total += (int) $archivo->getSize();
    }
    return $total;
}

/** Milisegundos Unix -> "2026-11-14T15:30:00.123-03:00" en la zona horaria configurada. */
function iso_ms(int $ms): string
{
    $d = DateTimeImmutable::createFromFormat('U.u', sprintf('%d.%06d', intdiv($ms, 1000), ($ms % 1000) * 1000));
    return $d->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('Y-m-d\TH:i:s.vP');
}
