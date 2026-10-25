import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function harness(saved={}){
 const keys=[...new Set([...html.matchAll(/FIG\.([a-z]+)/g)].map(m=>m[1]))];
 const FIG=Object.fromEntries(keys.map(k=>[k,k]));
 const scope={FIG,FIG_CLAVE:new Map(keys.map(k=>[k,k])),lsGet:()=>saved,lsSet:(k,v)=>{saved=JSON.parse(JSON.stringify(v));},hoyISO:()=> '2026-10-25',renderHome(){},renderMovimiento(){},renderRutinaMov(){},sesionEjercicios:()=>[],EX_EQUIPO:{},EX_FOTOS:{pushup:['Pushups/0.webp','Pushups/1.webp']},EX_FOTO_BASE:'assets/exercises-webp/'};
 vm.runInNewContext(html.slice(html.indexOf('const RUTINA_SEMANAL ='),html.indexOf('function renderMovimiento(){')),scope);
 return {scope,run:s=>vm.runInNewContext(s,scope),saved:()=>saved};
}
test('casa ofrece seis ejercicios sin máquinas con fotos locales y días de descanso',()=>{
 const {run}=harness();run("lugarEntreno='casa'");
 assert.equal(run('EJERCICIOS_CASA.length'),6);
 for(const e of run('EJERCICIOS_CASA')){
  assert.ok(e.pasos.length>=2); assert.equal(e.fotos.length,2);
  for(const path of e.fotos) assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
 }
 assert.equal(run('rutinaActual(1).ejercicios.length'),4);
 assert.equal(run('rutinaActual(2).descanso'),true);
 assert.equal(run('rutinaActual(5).ejercicios.length'),4);
});
test('elegir ejercicios persiste por lugar y día y no confunde las marcas tras reordenar',()=>{
 const {scope,run,saved}=harness();
 run("lugarEntreno='casa';diaMovActivo=1");
 scope.marcarEjercicioEntreno('home-squat');
 scope.elegirEjercicio('home-squat');
 scope.elegirEjercicio('home-heel');
 assert.ok(!run('rutinaActual(1).ejercicios.map(e=>e.id)').includes('home-squat'));
 assert.ok(!run('hechosEntreno(1)').includes('home-heel'));
 scope.elegirEjercicio('home-squat');
 assert.ok(run('hechosEntreno(1)').includes('home-squat'));
 run("lugarEntreno='gimnasio'"); assert.equal(run('hechosEntreno(1).length'),0);
 assert.equal(run('rutinaActual(1).ejercicios.length'),5);
 run("lugarEntreno='casa'"); scope.guardarEntrenamiento();
 const resumed=harness(saved());
 assert.equal(resumed.run('lugarEntreno'),'casa');
 assert.ok(resumed.run('rutinaActual(1).ejercicios.map(e=>e.id)').includes('home-heel'));
 assert.ok(resumed.run('hechosEntreno(1)').includes('home-squat'));
 scope.restaurarEntreno();assert.equal(run('rutinaActual(1).ejercicios.length'),4);
 scope.elegirEjercicio('not-real');assert.equal(run('rutinaActual(1).ejercicios.length'),4);
});
test('gimnasio conserva los 26 ejercicios y sus instrucciones y migra marcas anteriores',()=>{
 const {scope,run}=harness();assert.equal(run('EJERCICIOS_GYM.length'),26);
 assert.ok(run('EJERCICIOS_GYM.every(e=>e.pasos.length===2)'));
 scope.sesionEjercicios=()=>[1];assert.equal(JSON.stringify(scope.hechosEntreno(1)),'["incline"]');
 run('diaMovActivo=1');scope.marcarEjercicioEntreno('bench');
 assert.equal(JSON.stringify(scope.hechosEntreno(1)),'["incline","bench"]');
});

test('repeticiones, series y kilos se guardan sin perder progreso y separados por lugar',()=>{
 const {scope,run,saved}=harness();
 assert.equal(scope.guardarValorEjercicio('bench','reps','12'),true);
 assert.equal(scope.guardarValorEjercicio('bench','series','3'),true);
 assert.equal(scope.guardarValorEjercicio('bench','kg','22,5'),true);
 assert.equal(scope.valoresEjercicio('bench').kg,22.5);
 run('diaMovActivo=1');scope.marcarEjercicioEntreno('bench');
 const reloaded=harness(saved());
 assert.equal(reloaded.scope.valoresEjercicio('bench').reps,12);
 assert.equal(reloaded.scope.valoresEjercicio('bench').series,3);
 assert.ok(reloaded.scope.hechosEntreno(1).includes('bench'));
 run("lugarEntreno='casa'");
 assert.equal(Object.keys(scope.valoresEjercicio('bench')).length,0);
 assert.equal(scope.guardarValorEjercicio('home-squat','kg','0'),true);
 assert.equal(scope.valoresEjercicio('home-squat').kg,0);
 run("lugarEntreno='gimnasio'");assert.equal(scope.valoresEjercicio('bench').kg,22.5);
 for(const [campo,valor] of [['reps','0'],['reps','2.5'],['series','-1'],['series','21'],['kg','-5'],['kg','Infinity'],['kg','texto']]) assert.equal(scope.guardarValorEjercicio('bench',campo,valor),false);
 assert.equal(scope.guardarValorEjercicio('unknown','kg','10'),false);
 assert.equal(scope.valoresEjercicio('bench').kg,22.5);
 assert.equal(scope.guardarValorEjercicio('bench','kg',''),true);
 assert.equal(scope.valoresEjercicio('bench').kg,undefined);
});
test('plancha pide segundos y los ejercicios por repeticiones piden repeticiones',()=>{
 const {scope,run}=harness();
 assert.ok(scope.valoresEjercicioHTML(run('EJERCICIOS_CASA.find(e=>e.id==="home-plank")')).includes('Segundos por serie'));
 assert.ok(scope.valoresEjercicioHTML(run('EJERCICIOS_GYM[0]')).includes('Repeticiones por serie'));
});
