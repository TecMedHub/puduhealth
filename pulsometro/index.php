<?php
declare(strict_types=1);
require __DIR__ . '/inc/datos.php';
require __DIR__ . '/inc/plantilla.php';

encabezado('Medición en vivo', 'index.php');
?>
<!-- Antes de la primera grabación se pide el consentimiento informado. -->
<div id="pantallaConsentimiento" class="velo" hidden>
  <form id="formConsentimiento" class="tarjeta dialogo dialogo-consent" autocomplete="off">
    <h2>Consentimiento informado</h2>
    <p class="tenue">Lea con calma. Participar es voluntario.</p>
    <ul class="consent-lista">
      <li><b>Qué se registra:</b> la señal de color de la yema del dedo captada por la cámara, la frecuencia
        cardíaca calculada, el movimiento del celular, el esfuerzo percibido (opcional) y las horas de cada prueba.</li>
      <li><b>Para qué:</b> desarrollar y validar la medición de frecuencia cardíaca del proyecto PuduHealth
        (NASA Space Apps Challenge 2026, TecMedHub, Universidad Austral de Chile).</li>
      <li><b>Qué no se guarda:</b> ni su nombre, ni fotos, ni video. Sólo valores promedio de color por cuadro.</li>
      <li><b>Cómo se usan:</b> sus datos se vinculan únicamente a su código de participante, se guardan en el
        servidor del equipo y luego se analizan sin identificación personal.</li>
      <li><b>Cuánto se guardan:</b> se borran a más tardar 12 meses después de recogerlos, o antes si usted lo pide.</li>
      <li><b>Sus derechos:</b> puede retirarse y pedir que borremos sus datos en cualquier momento entregando su
        código al equipo.</li>
      <li><b>Importante:</b> esto no es un dispositivo médico y no sirve para diagnosticar ni tratar.</li>
    </ul>
    <label class="campo en-linea consent-check">
      <input type="checkbox" id="chkConsentimiento">
      <span>Leí y acepto participar</span>
    </label>
    <div class="botones"><button type="submit" id="btnAceptar" class="primario" disabled>Aceptar y continuar</button></div>
  </form>
</div>

<!-- Al terminar una prueba se pregunta el esfuerzo percibido (escala de Borg 6–20). -->
<div id="pantallaBorg" class="velo" hidden>
  <div class="tarjeta dialogo dialogo-borg" role="dialog" aria-modal="true" aria-labelledby="tituloBorg">
    <h2 id="tituloBorg">¿Qué tan duro fue el esfuerzo?</h2>
    <p class="tenue mini">
      Escala de Borg · <b id="borgPrueba"></b> de <b id="borgPersona"></b>.
      Pregunte cómo sintió el esfuerzo <b>durante la prueba</b> y toque el número.
    </p>
    <div class="escala-borg" id="escalaBorg">
      <?php foreach (BORG as $valor => $texto): ?>
        <button type="button" data-valor="<?= (int) $valor ?>" data-texto="<?= h(borg_descripcion($valor)) ?>"
          data-corto="<?= h(BORG_CORTO[$valor] ?? '') ?>" aria-pressed="false"
          class="<?= $valor <= 10 ? 'suave' : ($valor <= 14 ? 'moderado' : 'intenso') ?><?= $texto === '' ? ' intermedio' : '' ?>">
          <span class="borg-num"><?= (int) $valor ?></span>
          <span class="borg-texto"><?= h(BORG_CORTO[$valor] ?? '') ?></span>
        </button>
      <?php endforeach; ?>
    </div>
    <div id="borgElegido" class="borg-elegido" aria-live="polite">Toque un número · los pares (+) son intermedios</div>
    <div class="botones borg-acciones">
      <button type="button" id="btnBorgGuardar" class="primario" disabled>Guardar y seguir</button>
      <button type="button" id="btnBorgOmitir">Omitir</button>
    </div>
  </div>
</div>

<section class="tarjeta participante">
  <div>
    <div class="etiqueta">Tu código de participante</div>
    <div id="codigoPersona" class="codigo-persona">—</div>
    <div class="tenue mini">Anótalo: sirve para pedir que borremos tus datos.</div>
  </div>
  <button id="btnCambiarPersona">Usar otro código</button>
  <form id="formCodigo" class="en-fila-completa" autocomplete="off" hidden>
    <label class="campo">Código que ya tienes
      <input id="inCodigo" maxlength="6" placeholder="P-7KQ2" autocapitalize="characters" spellcheck="false">
    </label>
    <div id="errorCodigo" class="error"></div>
    <div class="botones">
      <button type="submit" class="primario">Usar este código</button>
      <button type="button" id="btnCancelarCodigo">Cancelar</button>
    </div>
  </form>
</section>

<div id="avisoHttps" class="aviso" hidden>
  <strong>La cámara necesita HTTPS.</strong> El navegador sólo permite usar la cámara en
  <code>https://</code> o en <code>localhost</code>. Para probar desde el celular use un túnel
  (ver README) o el <em>modo demo</em>.
</div>

<section class="tarjeta protocolo">
  <h2>Protocolo de pruebas <small>cada prueba se detiene sola al cumplir el tiempo, se guarda en este celular y se sube al servidor · se puede pausar y seguir después</small></h2>
  <div class="pruebas" id="pruebas">
    <?php foreach (PRUEBAS as $codigo => $p): ?>
      <button class="prueba" data-codigo="<?= h($codigo) ?>" data-nombre="<?= h($p['nombre']) ?>" data-duracion="<?= (int) $p['duracion'] ?>">
        <span class="prueba-nombre"><?= h($p['nombre']) ?></span>
        <span class="prueba-tiempo"><?= sprintf('%d:%02d', intdiv($p['duracion'], 60), $p['duracion'] % 60) ?> min</span>
        <span class="prueba-estado">Pendiente</span>
      </button>
    <?php endforeach; ?>
  </div>
  <div id="enCurso" class="en-curso" hidden>
    <div>
      <div class="etiqueta">Grabando</div>
      <div><b id="cursoNombre">—</b> · faltan <span id="cursoRestante" class="reloj">00:00</span></div>
      <div class="medidor"><div id="cursoBarra" class="verde"></div></div>
      <div id="cursoDetalle" class="tenue mini"></div>
    </div>
    <div class="botones">
      <button id="btnPausarPrueba" class="primario">Pausar</button>
      <button id="btnDetenerPrueba" class="rojo">Terminar</button>
    </div>
  </div>
  <div id="mensaje" class="tenue"></div>
  <div id="cajaReintentar" class="aviso" hidden>
    <span id="textoPendientes"></span>
    <button id="btnReintentar" class="primario">Reintentar subir</button>
  </div>
  <div id="historial" hidden>
    <h2>Pruebas de <span id="historialCodigo"></span> <small>guardadas en este celular (no se borran al subirlas)</small></h2>
    <div id="listaPruebas"></div>
  </div>
</section>

<details class="tarjeta instrucciones">
  <summary>¿Cómo medir?</summary>
  <ol>
    <li>Pulse <b>Iniciar cámara</b> (use Chrome en Android; en iPhone la linterna no siempre funciona desde la web).</li>
    <li>Cubra <b>la cámara trasera y el flash</b> con la yema del dedo índice.</li>
    <li>No presione fuerte: si aprieta, la onda se aplana.</li>
    <li>Quédese quieto unos 10 s hasta que la calidad sea <b>Buena</b> y luego pulse la prueba.</li>
    <li>En <b>Trotar</b> y <b>Correr</b> el movimiento agrega ruido: sujete el teléfono firme contra el dedo.
      Los segundos sin señal quedan registrados (FC vacía) y no arruinan el resto de la prueba.</li>
    <li>No cambie de aplicación ni apague la pantalla durante una prueba: si pasa, la prueba <b>se pausa sola</b>
      y se sigue tocándola de nuevo.</li>
    <li>Con <b>Pausar</b> puede detener una prueba, revisar o regrabar otra, y luego reanudarla donde quedó.
      Todas las pruebas quedan guardadas en el celular, también las ya subidas.</li>
  </ol>
</details>

<section class="controles tarjeta">
  <label class="campo">
    Cámara
    <select id="selCamara"><option value="">Trasera (automática)</option></select>
  </label>
  <div class="botones">
    <button id="btnCamara" class="primario">Iniciar cámara</button>
    <button id="btnDemo">Modo demo</button>
    <button id="btnLinterna" disabled>Linterna</button>
    <button id="btnDetener" disabled>Detener</button>
  </div>
  <label class="check">
    <input type="checkbox" id="chkBloquear" checked>
    Bloquear exposición, balance de blancos y enfoque (si el navegador lo permite)
  </label>
  <div id="estadoCamara" class="tenue"></div>
</section>

<section class="resumen">
  <div class="tarjeta bpm">
    <div class="etiqueta">Frecuencia cardíaca</div>
    <div><span id="valorBpm" class="numero">--</span> <span class="unidad">lpm</span></div>
    <div id="detalleBpm" class="tenue">picos: -- · espectro: --</div>
  </div>
  <div class="tarjeta">
    <div class="etiqueta">Calidad de la señal</div>
    <div class="medidor"><div id="barraCalidad"></div></div>
    <div id="textoCalidad" class="tenue">Sin señal</div>
  </div>
  <div class="tarjeta">
    <div class="etiqueta">Estado</div>
    <div id="estadoDedo" class="pastilla gris">Detenido</div>
    <div id="estadoFs" class="tenue">-- cuadros/s</div>
  </div>
  <div class="tarjeta vista" id="vista" hidden>
    <video id="video" playsinline muted></video>
    <div class="cruz" aria-hidden="true"></div>
  </div>
</section>

<section class="tarjeta">
  <h2>Señal cruda <small>promedio del canal rojo (zona central)</small></h2>
  <canvas id="gCrudo" class="grafico"></canvas>
</section>

<section class="tarjeta">
  <h2>Señal filtrada <small>pasabanda 0,7–3,5 Hz · ● latidos detectados</small></h2>
  <canvas id="gFiltrado" class="grafico"></canvas>
</section>

<section class="tarjeta">
  <h2>Tendencia de la frecuencia cardíaca <small>sólo lecturas con calidad Regular o Buena</small></h2>
  <canvas id="gTendencia" class="grafico bajo"></canvas>
</section>

<?php pie(['ppg.js', 'movimiento.js', 'grafico.js', 'app.js']); ?>
