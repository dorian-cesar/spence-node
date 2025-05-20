const mysql = require('mysql2/promise');
const axios = require('axios');

const INTERVALO_MILISEGUNDOS = 20 * 100;

let trackersGlobal = [];
let hashGlobal = '';

async function obtenerDatosIniciales() {
  const connection = await mysql.createConnection({
    host: 'ls-3c0c538286def4da7f8273aa5531e0b6eee0990c.cylsiewx0zgx.us-east-1.rds.amazonaws.com',
    user: 'dbmasteruser',
    password: 'eF5D;6VzP$^7qDryBzDd,`+w(5e4*qI+',
    database: 'masgps'
  });

  try {
    const user = 'spence';
    const pasw = '123';

    const [rows] = await connection.execute(
      'SELECT hash FROM hash WHERE user = ? AND pasw = ?',
      [user, pasw]
    );

    if (!rows.length) {
      throw new Error('Hash no encontrado');
    }

    hashGlobal = rows[0].hash;

    const trackerListRes = await axios.post(
      'http://www.trackermasgps.com/api-v2/tracker/list',
      { hash: hashGlobal }
    );

    trackersGlobal = trackerListRes.data.list;

  } finally {
    await connection.end(); // ✅ Cerramos la conexión después de usarla una vez
  }
}

async function main() {
  console.time('🌀 Tiempo total del ciclo');

  try {
    const chunks = [];
    for (let i = 0; i < trackersGlobal.length; i += 10) {
      chunks.push(trackersGlobal.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const total = [];

      for (const item of chunk) {
        const id = item.id;
        const imei = item.source.device_id;
        const plate = item.label.substring(0, 7);

        const stateRes = await axios.post(
          'http://www.trackermasgps.com/api-v2/tracker/get_state',
          { hash: hashGlobal, tracker_id: id }
        );

        const state = stateRes.data?.state;
        if (!state) continue;

        const lat = state.gps?.location?.lat;
        const lng = state.gps?.location?.lng;
        const last_u = state.last_update;
        const ultima_Conexion = new Date(last_u).toISOString().replace('T', ' ').substring(0, 19);

        const speed = state.gps?.speed || 0;
        const direccion = state.gps?.heading || 0;
        const numero_satelites = Math.floor(Math.random() * 6) + 10;
        const ignicion = state.inputs?.[0] ? 1 : 0;

        const fecha_actual = new Date();
        const fecha_inicio = new Date();
        const segundos = Math.floor((fecha_actual - fecha_inicio) / 1000);

        const empRes = await axios.get(
          'http://www.trackermasgps.com/api-v2/tracker/employee/read',
          {
            headers: { 'Content-Type': 'application/json' },
            data: { hash: hashGlobal, tracker_id: id }
          }
        );

        let fullName = 'No Asignado';
        let key_button = 'ABCDEF123456';
        let rut = '26694722-4';

        const current = empRes.data?.current;
        if (current) {
          fullName = `${current.first_name || ''} ${current.last_name || ''}`.trim();
          key_button = current.hardware_key || key_button;
          rut = current.personnel_number || rut;
        }

        const rut_sin_guion = rut.replace('-', '');
        const plate_sin_guion = plate.replace('-', '');
        const key_button8 = key_button.slice(-8);

        const json = {
          patente: plate_sin_guion,
          fecha_hora: new Date().toISOString().replace('T', ' ').substring(0, 19),
          latitud: lat,
          longitud: lng,
          direccion: direccion,
          velocidad: speed,
          estado_registro: 1,
          estado_ignicion: 1,
          numero_evento: 45, // ignicion === 1 ? 45 : 46,
          odometro: 0,
          numero_satelites: numero_satelites,
          hdop: 1,
          edad_dato: String(segundos),
          rut_conductor: key_button8,
          nombre_conductor: rut_sin_guion
        };

        total.push(json);
      }

      if (total.length > 0) {
        const payload = { posicion: total };
    

        console.time('📡 Tiempo respuesta Wisetrack');
        const insertRes = await axios.post(
          'https://gw.wisetrack.cl/BHP/1.0.0/InsertarPosicion',
          JSON.stringify(payload, null, 2),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer cf37bd88-78b8-4b5d-94d2-d3145f6480db'
            }
          }
        );
        console.timeEnd('📡 Tiempo respuesta Wisetrack');
        console.log(JSON.stringify(payload, null, 2));
        console.log('Respuesta Wisetrack:', JSON.stringify(insertRes.data, null, 4));
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.timeEnd('🌀 Tiempo total del ciclo');
}

async function iniciarEnvioPeriodico() {
  await obtenerDatosIniciales(); // ✅ Solo una vez al comienzo

  while (true) {
    const tiempoInicio = Date.now();
    console.log(`\n=== Iniciando ciclo a las ${new Date().toISOString()} ===`);
    await main();
    console.log(`Duración ciclo: ${((Date.now() - tiempoInicio) / 1000).toFixed(2)}s`);
    console.log(`Esperando ${INTERVALO_MILISEGUNDOS / 1000} segundos...\n`);
    await new Promise(resolve => setTimeout(resolve, INTERVALO_MILISEGUNDOS));
  }
}

iniciarEnvioPeriodico();
