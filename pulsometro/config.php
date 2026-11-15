<?php
/*
 * Configuración POR DEFECTO del Pulsómetro PPG (este archivo está en el repositorio).
 *
 * NO edite este archivo en el servidor. Cree allí un config.local.php con sólo lo que
 * quiera cambiar (git lo ignora, así la configuración real nunca se sube al repo):
 *
 *     <?php
 *     return [
 *         'dir_datos'    => '/var/lib/pulsometro',
 *         'forzar_https' => true,
 *     ];
 */
return [
    // Carpeta donde se guardan los JSON (una subcarpeta por persona).
    // Lo más seguro es que quede FUERA de la carpeta pública del sitio,
    // p. ej. '/var/lib/pulsometro'. El usuario del servidor web (www-data, http…)
    // debe poder escribir en ella.
    'dir_datos' => __DIR__ . '/datos',

    // Redirige http:// a https://. Actívelo cuando el sitio ya tenga certificado.
    // (La cámara del celular sólo funciona con HTTPS.)
    'forzar_https' => false,

    'zona_horaria' => 'America/Santiago',

    // Protección contra abuso (el sitio no tiene clave):
    'max_guardados_por_hora_ip' => 300,   // pruebas guardadas por hora desde una misma IP
    'max_espacio_mb'            => 2000,  // espacio total máximo de la carpeta de datos
];
