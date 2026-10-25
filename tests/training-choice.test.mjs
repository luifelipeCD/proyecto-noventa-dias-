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
