import * as THREE from 'three';
import { BRAKE_LIMIT,GATE_SPEED } from './brake-flight.mjs';

function label(title,sub) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f6edd6';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#d7744b';ctx.lineWidth=12;ctx.strokeRect(6,6,500,244);
  ctx.textAlign='center';ctx.fillStyle='#35453c';ctx.font='900 53px "PingFang SC",sans-serif';ctx.fillText(title,256,117);ctx.fillStyle='#a56143';ctx.font='25px "PingFang SC",sans-serif';ctx.fillText(sub,256,177);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide});
}
export function createChallengeWorld(scene,bike) {
  const cream=new THREE.MeshStandardMaterial({color:'#f8ecd2',roughness:.7});
  const red=new THREE.MeshStandardMaterial({color:'#d35e45',roughness:.6});
  const dark=new THREE.MeshStandardMaterial({color:'#3a4142',roughness:.65,metalness:.3});
  const metal=new THREE.MeshStandardMaterial({color:'#b1a48a',roughness:.35,metalness:.6});
  const signMaterial=label('慢 行 15','先按 S 刹车，再通过');
  const gates=[];
  for(let i=0;i<7;i++){
    const group=new THREE.Group();scene.add(group);
    const base=new THREE.Mesh(new THREE.BoxGeometry(.62,.16,.55),dark);base.position.set(0,.08,3.1);group.add(base);
    const post=new THREE.Mesh(new THREE.BoxGeometry(.2,1.28,.2),dark);post.position.set(0,.72,3.1);group.add(post);
    const hinge=new THREE.Group();hinge.position.set(0,1.34,3.1);group.add(hinge);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.12,.2,6.25),cream);bar.position.z=-3.0;hinge.add(bar);
    for(let j=0;j<10;j++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.135,.21,.3),red);stripe.position.z=-.22-j*.6;hinge.add(stripe);}
    const warning=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.825),signMaterial);warning.position.set(-4,1.25,3.23);warning.rotation.y=-Math.PI/2;group.add(warning);
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.08,8),metal);stick.position.set(-4,.56,3.23);group.add(stick);
    for(const o of [base,post,bar]){o.castShadow=true;o.receiveShadow=true;}
    gates.push({group,hinge,angle:0});
  }
  // 独立制动踏板：不拆除原来的传动脚踏。
  const brake=new THREE.Group();brake.position.set(.1,.23,.19);bike.group.add(brake);
  const fixed=new THREE.Mesh(new THREE.BoxGeometry(.052,.09,.09),dark);fixed.position.y=-.04;brake.add(fixed);
  const bracket=new THREE.Mesh(new THREE.BoxGeometry(.13,.023,.045),metal);bracket.position.set(.046,0,0);brake.add(bracket);
  const pedal=new THREE.Mesh(new THREE.BoxGeometry(.12,.016,.10),dark);pedal.position.set(.11,.012,0);pedal.castShadow=true;brake.add(pedal);
  const stripes=new THREE.Mesh(new THREE.BoxGeometry(.095,.018,.022),red);stripes.position.copy(pedal.position);brake.add(stripes);
  const crack=new THREE.Mesh(new THREE.BoxGeometry(.009,.028,.049),red);crack.position.set(.025,0,0);crack.rotation.z=.35;crack.visible=false;brake.add(crack);
  const anchor=new THREE.Vector3(.21,.25,.19);
  let flyingPiece=null,pieceTime=0;
  const trailGeo=new THREE.BufferGeometry();const trailArray=new Float32Array(64*3);trailGeo.setAttribute('position',new THREE.BufferAttribute(trailArray,3));trailGeo.setDrawRange(0,0);
  const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:'#ffe1a2',transparent:true,opacity:.45}));trail.frustumCulled=false;scene.add(trail);let trailPoints=[];
  function snap(distance,lane){bracket.visible=pedal.visible=stripes.visible=false;flyingPiece=new THREE.Group();scene.add(flyingPiece);flyingPiece.add(bracket.clone(),pedal.clone(),stripes.clone());flyingPiece.children.forEach(m=>m.visible=true);flyingPiece.position.set(.1,.26,lane+.19);flyingPiece.userData={distance,lane};pieceTime=0;}
  function reset(){bracket.visible=pedal.visible=stripes.visible=true;crack.visible=false;trailPoints=[];trailGeo.setDrawRange(0,0);if(flyingPiece){scene.remove(flyingPiece);flyingPiece=null;}}
  function update(c,distance,speed,held,dt){
    const start=Math.max(0,c.gates.findIndex(g=>!g.passed)-1);
    for(let i=0;i<gates.length;i++){const data=c.gates[start+i],view=gates[i];view.group.visible=!!data;if(!data)continue;view.group.position.x=data.x-distance;
      const open=data.passed||(data.braked>=.28&&speed<=GATE_SPEED);const target=open?Math.PI/2:0;view.angle+=(target-view.angle)*(1-Math.exp(-8*dt));view.hinge.rotation.x=view.angle;
    }
    crack.visible=c.brakeTime>BRAKE_LIMIT*.5;brake.rotation.z=held&&c.phase==='ride'?-.12:0;
    if(flyingPiece){pieceTime+=dt;flyingPiece.position.x=flyingPiece.userData.distance-distance+.1+pieceTime*2;flyingPiece.position.y=Math.max(.03,.26+pieceTime*2.4-pieceTime*pieceTime*4.5);flyingPiece.rotation.z+=dt*8;flyingPiece.rotation.x+=dt*4;}
    if(c.phase==='flight'){const f=c.flight;if(!trailPoints.length||f.x-trailPoints[trailPoints.length-1].x>.35){trailPoints.push({x:f.x,y:f.y+.86});if(trailPoints.length>64)trailPoints.shift();}trailPoints.forEach((p,i)=>{trailArray[i*3]=p.x-f.x;trailArray[i*3+1]=p.y;trailArray[i*3+2]=f.lane;});trailGeo.attributes.position.needsUpdate=true;trailGeo.setDrawRange(0,trailPoints.length);}
  }
  return {update,snap,reset,anchor,brake,trail};
}
