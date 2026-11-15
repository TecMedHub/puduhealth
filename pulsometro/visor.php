<?php
declare(strict_types=1);
require __DIR__ . '/inc/plantilla.php';

encabezado('Visor', 'visor.php');
?>
<div class="visor-cols">
  <aside class="tarjeta lista">
    <h2>Abrir registro</h2>
    <label class="campo">
      <span>Archivo JSON de una prueba, o CSV (<code>t,r,g,b</code> o <code>t,r</code>)</span>
      <input type="file" id="archivo" accept=".csv,.txt,.json">
    </label>
    <p class="tenue mini">
      El archivo se analiza en su navegador; no se sube a ningún servidor.
      Sirve para los JSON del servidor o descargados desde <a href="index.php">Medición en vivo</a>,
      y para señales extraídas de videos con Python.
    </p>
  </aside>

  <div id="visor">
    <section class="tarjeta">
      <div class="cabecera-reg">
        <div>
          <h2 id="tituloReg">Abra un archivo CSV</h2>
          <div id="infoReg" class="tenue"></div>
        </div>
        <div class="botones" id="accionesReg" hidden>
          <button id="btnCsvReg">Descargar CSV</button>
        </div>
      </div>
      <div id="mensaje" class="tenue"></div>
    </section>

    <section class="cifras" id="cifras"></section>

    <section class="tarjeta">
      <div class="controles-zoom">
        <label class="campo en-linea">Ventana
          <select id="selZoom">
            <option value="5">5 s</option>
            <option value="10" selected>10 s</option>
            <option value="20">20 s</option>
            <option value="30">30 s</option>
            <option value="0">Todo</option>
          </select>
        </label>
        <input type="range" id="rangoPos" min="0" max="1000" value="0" aria-label="Posición en el registro">
      </div>
      <h2>Señal cruda <small>canal rojo</small></h2>
      <canvas id="gCrudo" class="grafico"></canvas>
      <h2>Señal filtrada <small>0,7–3,5 Hz · ● latidos</small></h2>
      <canvas id="gFiltrado" class="grafico"></canvas>
    </section>

    <div class="dos-cols">
      <section class="tarjeta">
        <h2>Intervalos entre latidos <small>ms (tacograma)</small></h2>
        <canvas id="gIbi" class="grafico bajo"></canvas>
      </section>
      <section class="tarjeta">
        <h2>FC en ventanas de 10 s <small>lpm</small></h2>
        <canvas id="gTendencia" class="grafico bajo"></canvas>
      </section>
    </div>

    <section class="tarjeta">
      <h2>Espectro <small>potencia en la banda 42–210 lpm</small></h2>
      <canvas id="gEspectro" class="grafico bajo"></canvas>
    </section>
  </div>
</div>

<?php pie(['ppg.js', 'grafico.js', 'visor.js']); ?>
