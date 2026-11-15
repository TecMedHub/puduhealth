<?php
declare(strict_types=1);
require_once __DIR__ . '/nucleo.php';

function encabezado(string $titulo, string $activa): void
{
    $paginas = ['index.php' => 'Medición en vivo', 'visor.php' => 'Visor'];
    ?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b1020">
  <meta name="robots" content="noindex, nofollow">
  <title><?= h($titulo) ?> · Pulsómetro PPG</title>
  <link rel="stylesheet" href="<?= h(recurso('estilo.css')) ?>">
</head>
<body>
  <header class="barra">
    <div class="marca"><span class="latido" aria-hidden="true">♥</span> Pulsómetro PPG</div>
    <nav>
      <?php foreach ($paginas as $url => $nombre): ?>
        <a href="<?= $url ?>" class="<?= $url === $activa ? 'activa' : '' ?>"><?= h($nombre) ?></a>
      <?php endforeach; ?>
    </nav>
  </header>
  <main>
<?php
}

/** Huella corta del contenido de un archivo: cambia sólo si cambia el archivo. */
function huella(string $ruta): string
{
    static $cache = [];
    if (!isset($cache[$ruta])) {
        $md5 = @md5_file($ruta);
        $cache[$ruta] = $md5 ? substr($md5, 0, 10) : '0';
    }
    return $cache[$ruta];
}

/**
 * URL de un archivo de assets/ versionada por su contenido (?v=<huella>): al subir una versión
 * nueva cambia la URL y el navegador la descarga sin tener que forzar la recarga.
 * (El HTML no se guarda en caché: nucleo.php envía Cache-Control: no-store.)
 */
function recurso(string $archivo): string
{
    return 'assets/' . $archivo . '?v=' . huella(__DIR__ . '/../assets/' . $archivo);
}

/** Versión de la app (huella de todo el código), se muestra al pie para saber qué hay en el servidor. */
function version_app(): string
{
    $base = dirname(__DIR__);
    $archivos = array_merge(glob($base . '/*.php') ?: [], glob($base . '/inc/*.php') ?: [], glob($base . '/assets/*') ?: []);
    $archivos = array_filter($archivos, fn($f) => is_file($f) && strpos(basename($f), 'config') !== 0);
    sort($archivos);
    $todo = '';
    foreach ($archivos as $f) {
        $todo .= substr($f, strlen($base)) . ':' . huella($f) . "\n";
    }
    return substr(md5($todo), 0, 8);
}

function pie(array $scripts = []): void
{
    ?>
  </main>
  <footer class="pie">
    Prototipo de hackatón (NASA Space Apps). <strong>No es un dispositivo médico.</strong>
    Las mediciones son referenciales. Las pruebas del protocolo se guardan en el servidor del equipo.
    · Versión <code><?= h(version_app()) ?></code>
  </footer>
  <?php foreach ($scripts as $s): ?>
    <script src="<?= h(recurso($s)) ?>"></script>
  <?php endforeach; ?>
</body>
</html>
<?php
}
