let timestate = 'initial',
    state_timer = null,
    buttons,
    auto = false,
    //textures
    terrain_material,
    terrain_texture,
    satellite_texture,
    water_material,
    roads_material,
    height_material,
    bump_material,
    //meshes
    water_mesh,
    roads_mesh,
    height_mesh,
    bump_mesh,
    //anim
    roadsMaterialTween,
    heightMaterialTween,
    bumpMaterialTween,
    waterMeshTween,
    roadsMeshTween,
    heightMeshTween,
    bumpMeshTween;

let container = document.getElementById('screen');

let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

let scene = new THREE.Scene();
scene.background = new THREE.Color().setRGB({r:1, g:1, b:1});
scene.fog = new THREE.Fog(scene.background, 1, 10000);

let camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000); //30
camera.position.set(-254, 108, 152);

// controls
let controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.minDistance = 180;
controls.maxDistance = 800;
controls.maxPolarAngle = Math.PI / 2.1;
controls.autoRotate = false;

// LIGHTS
let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
hemiLight.color.setRGB(0.2, 0.52, 1);
hemiLight.groundColor.setRGB(1, 0.78, 0.5);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

//SUN TARGET
var targetObject = new THREE.Object3D();
scene.add(targetObject);

let dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.color.setRGB(1, 0.96, 0.9);
dirLight.position.set(0, -15, 2000);
dirLight.position.multiplyScalar(1);
dirLight.target = targetObject;
scene.add(dirLight);

dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;

let d = 150;

dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

dirLight.shadow.camera.far = 2600;
dirLight.shadow.bias = -0.0001;

//HELPERS 
// let axes_helper = new THREE.AxesHelper( 200 );
// scene.add(axes_helper);

// let hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
// scene.add(hemiLightHelper);

// let dirLightHeper = new THREE.DirectionalLightHelper(dirLight, 10);
// scene.add(dirLightHeper);

// GROUND
let groundGeo = new THREE.CircleBufferGeometry(3000, 24);
let groundMat = new THREE.MeshLambertMaterial({
    color: 0xffffff
});
groundMat.color.setRGB(.05, .05, .05);

let ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.y = 0;
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.castShadow = true;
scene.add(ground);

// SKYDOME
let vertexShader = document.getElementById('vertexShader').textContent;
let fragmentShader = document.getElementById('fragmentShader').textContent;
let uniforms = {
    "topColor": {
        // value: new THREE.Color(0x0077ff)
        value: new THREE.Color(0, 0, 0)
    },
    "bottomColor": {
        // value: new THREE.Color(1, 1, 1) // day
        value: new THREE.Color(.2, .2, .2) //night
    },
    "offset": {
        value: 33
    },
    "exponent": {
        value: 0.6
    }
};
uniforms["topColor"].value.copy(hemiLight.color);

scene.fog.color.copy(uniforms["bottomColor"].value);

let skyGeo = new THREE.SphereBufferGeometry(4000, 32, 15);
let skyMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
});

let sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// TERRAIN
let img = new Image();
img.onload = function () {
    let accuracy = 128;
    let data = getHeightData(img, accuracy);

    let box = new THREE.BoxGeometry(200,1,200,accuracy-1,1,accuracy-1);
    let top_verticles = [];
    for ( var i = 0, k = 0, l = box.vertices.length; i < l; i++ ) {
        if(box.vertices[i].y == box.parameters.height/2){
            top_verticles[k] = box.vertices[i];
            k++;
        }
    }

    top_verticles.sort(sortFunction);
    function sortFunction(a, b) {
        if(a.z === b.z){
            if(a.x === b.x){
                return 0;
            }else {
                return (a.x < b.x) ? -1 : 1;
            }
        }else{
            return (a.z < b.z) ? -1 : 1;
        }
    }
    for ( var i = 0, l = top_verticles.length; i < l; i++ ) {
        top_verticles[i].y = data[i];
    }

    let terrain_bumpmap = new THREE.TextureLoader().load('model/satellite_1024_bump.jpg');
    terrain_texture = new THREE.TextureLoader().load('model/terrain_1024.jpg');
    satellite_texture = new THREE.TextureLoader().load('model/satellite_1024.jpg', init);
    terrain_material = new THREE.MeshStandardMaterial({
        map: satellite_texture,
        roughness: 0.8,
        bumpMap: terrain_bumpmap,
        bumpScale: 1,
        aoMap: terrain_bumpmap,
        aoMapIntensity: .4,
    });
    let terrain = new THREE.Mesh( box, terrain_material );
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    
    //LAYERS
    // water
    let water_plane = new THREE.PlaneGeometry( 200, 200, 1, 1 );
    let water_opacity = new THREE.TextureLoader().load('model/water_mask.jpg');
    let water_normal = new THREE.TextureLoader().load('model/waternormals.jpg');
    water_material = new THREE.MeshPhongMaterial({
        alphaMap: water_opacity, 
        transparent: true, 
        opacity: .5,
        // emissive: {r:1, g:1, b:1},
        reflectivity: 1,
        shininess: 100,
        color: 0x000000,
        normalMap: water_normal,
        normalScale: ({x:.3, y:.3})
    });
    water_mesh = new THREE.Mesh( water_plane, water_material );
    water_mesh.rotation.x = -Math.PI / 2;
    water_mesh.position.y = 1.7;
    water_mesh.receiveShadow = true;
    scene.add(water_mesh);


    // roads
    let roads_plane = new THREE.PlaneGeometry( 200, 200, accuracy-1, accuracy-1 );
    for ( var i = 0, l = roads_plane.vertices.length; i < l; i++ ) {
        roads_plane.vertices[i].z = data[i];
    }
    let roads_texture = new THREE.TextureLoader().load('model/glow_map_mask.png');
    roads_material = new THREE.MeshLambertMaterial({
        alphaMap: roads_texture, 
        emissive: '#FFFCDB', 
        emissiveMap: roads_texture, 
        transparent: true, 
        lightMap: roads_texture, 
        opacity: 0
    });
    roads_mesh = new THREE.Mesh( roads_plane, roads_material );
    roads_mesh.rotation.x = -Math.PI / 2;
    // roads_mesh.position.y = .01;
    roads_mesh.position.y = .1;
    scene.add(roads_mesh);

    // height_map
    let height_texture = new THREE.TextureLoader().load('model/height_map_smooth_light.png');
    height_material = new THREE.MeshLambertMaterial({
        map: height_texture,
        transparent: true, 
        opacity: 0
    });
    height_mesh = new THREE.Mesh( roads_plane, height_material );
    height_mesh.rotation.x = -Math.PI / 2;
    height_mesh.position.y = 0;
    scene.add(height_mesh);

    // bump_map
    let bump_texture = new THREE.TextureLoader().load('model/satellite_1024_bump.jpg');
    bump_material = new THREE.MeshLambertMaterial({
        alphaMap: bump_texture, 
        map: bump_texture,
        transparent: true, 
        opacity: 0
    });
    bump_mesh = new THREE.Mesh( roads_plane, bump_material );
    bump_mesh.rotation.x = -Math.PI / 2;
    bump_mesh.position.y = 0;
    scene.add(bump_mesh);

    roadsMaterialTween = new TWEEN.Tween(roads_material);
    heightMaterialTween = new TWEEN.Tween(height_material);
    bumpMaterialTween = new TWEEN.Tween(bump_material);
    waterMeshTween = new TWEEN.Tween(water_mesh.position);
    roadsMeshTween = new TWEEN.Tween(roads_mesh.position);
    heightMeshTween = new TWEEN.Tween(height_mesh.position);
    bumpMeshTween = new TWEEN.Tween(bump_mesh.position);
};
img.src = "model/height_map_smooth_light.png";

// RENDERER
renderer.gammaInput = true;
renderer.gammaOutput = true;

renderer.shadowMap.enabled = true;

animate();

function animate() {
    requestAnimationFrame( animate );
    render();
    // console.log(camera.position);
    if(auto){
        controls.update();
    }
    TWEEN.update();
}

function render() {
    renderer.render(scene, camera);
}

function getHeightData(img, accuracy) {
    var canvas = document.createElement( 'canvas' );
    canvas.width = accuracy;
    canvas.height = accuracy;
    var context = canvas.getContext( '2d' );

    var size = accuracy * accuracy, data = new Float32Array( size );

    context.drawImage(img,0,0);

    for ( var i = 0; i < size; i ++ ) {
        data[i] = 0
    }

    var imgd = context.getImageData(0, 0, accuracy, accuracy);
    var pix = imgd.data;

    var j=0;
    for (var i = 0, n = pix.length; i < n; i += (4)) {
        var all = pix[i]+pix[i+1]+pix[i+2];
        data[j++] = all/30;
    }

    return data;
}

let lightTween = new TWEEN.Tween(dirLight.position),
    skyTween = new TWEEN.Tween(sky.material.uniforms.bottomColor.value),
    groundTween = new TWEEN.Tween(ground.material.color);

let day_states = {
    initial: {
        state: 'initial',
        sun_coords: { x:0, y:-15, z:2000 },
        sky_color: { r:.2, g:.2, b:.2 },
        ground_color: { r:.05, g:.05, b:.05 },
        next_state: 'morning'
    },
    morning: {
        state: 'morning',
        sun_coords: { x: -500, y: 425, z: 1888 },
        sky_color: { r:1, g:1, b:1 },
        ground_color: { r:1, g:0.78, b:0.5 },
        next_state: 'daytime'
    },
    daytime: {
        state: 'daytime',
        sun_coords: { x: -1680, y: 862, z: 656 },
        sky_color: { r:1, g:1, b:1 },
        ground_color: { r:1, g:0.78, b:0.5 },
        next_state: 'evening'
    },
    evening: {
        state: 'evening',
        sun_coords: { x: -1672, y: 254, z: -1066 },
        sky_color: { r:1, g:1, b:1 },
        ground_color: { r:1, g:0.78, b:0.5 },
        next_state: 'night'
    },
    night: {
        state: 'initial',
        sun_coords: { x: -1473, y: -15, z: -1351 },
        sky_color: { r:.2, g:.2, b:.2 },
        ground_color: { r:.05, g:.05, b:.05 },
        next_state: 'initial'
    }
}

function change_state(state){
    if(state_timer != null) clearInterval(state_timer);
    let sequence = []
        sequence_time = 5000;

    for (const key in day_states) {
        if (day_states.hasOwnProperty(key)) {
            const type = day_states[key];

            if(key == timestate && state !== timestate){
                timestate = state;
                construct_sequence(type.next_state, state);
                
                let step_time = (sequence_time + (sequence.length - 1) * 1000) / sequence.length;
                let interval_counter = 0;

                tween_animate(sequence[interval_counter], step_time);
                interval_counter++;
                state_timer = setInterval(() => {
                    if(interval_counter < sequence.length){
                        tween_animate(sequence[interval_counter], step_time);
                        interval_counter++;
                    }else{
                        clearInterval(state_timer);
                    }
                }, step_time);
            }
        }
    }

    function construct_sequence(next_state, target_state){
        if(next_state != target_state){
            sequence.push(day_states[next_state]);
            construct_sequence(day_states[next_state].next_state, state);
        }else{
            sequence.push(day_states[next_state]);
            return sequence;
        }
    }
}

function tween_animate(data, time){
    setActiveState(data.state);

    lightTween._valuesStart = {};
    lightTween._object = dirLight.position;
    lightTween.to(data.sun_coords, time).start();

    skyTween._valuesStart = {};
    skyTween._object = sky.material.uniforms.bottomColor.value;
    skyTween.to(data.sky_color, time).start();

    groundTween._valuesStart = {};
    groundTween._object = ground.material.color;
    groundTween.to(data.ground_color, time).start();
}

function init(){
    document.body.classList.remove("loading");
    
    setTimeout(() => {
        document.querySelectorAll('.loader')[0].remove();
        change_state('morning');
    }, 1000);
}

function setActiveState(state){
    buttons.forEach((el, key) => {
        if(el.dataset.time === state){
            el.classList.add("active");
        }else{
            el.classList.remove("active");
        }
    });
}

function setAnimStateBetween(){
    roadsMaterialTween._valuesStart = {};
    roadsMaterialTween._object = roads_material;
    heightMaterialTween._valuesStart = {};
    heightMaterialTween._object = height_material;
    bumpMaterialTween._valuesStart = {};
    bumpMaterialTween._object = bump_material;
    heightMeshTween._valuesStart = {};
    heightMeshTween._object = height_mesh.position;
    bumpMeshTween._valuesStart = {};
    bumpMeshTween._object = bump_mesh.position;
    waterMeshTween._valuesStart = {};
    waterMeshTween._object = water_mesh.position;
    roadsMeshTween._valuesStart = {};
    roadsMeshTween._object = roads_mesh.position;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    render();
}
window.addEventListener( 'resize', onWindowResize, false );

document.addEventListener("DOMContentLoaded", () => { 
    let map_type_sel = document.getElementById('map_type'),
        auto_camera_sw = document.getElementById('camera_automode'),
        auto_time_sw = document.getElementById('daystate_automode'),
        roads_sw = document.getElementById('roads_sw'),
        water_sw = document.getElementById('water_sw'),
        bump_sw = document.getElementById('bump_sw'),
        shadow_sw = document.getElementById('shadow_sw');

    // buttons
    buttons = document.querySelectorAll('.controls button');
    buttons.forEach((el, key) => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            let target = e.target;

            if(target.dataset.type === "time"){
                clearInterval(state_timer);
                auto_time_sw.checked = false;
                change_state(target.dataset.time);
                buttons.forEach((el, key) => {
                    el.classList.remove("target");
                });
                target.classList.add("target");
            }
            if(target.dataset.type === "layers-switch"){
                let time = 2000;
                if(!target.classList.contains("active")){
                    target.classList.add("active");
                    setAnimStateBetween();
                    roadsMaterialTween.to({opacity:1}, time).start();
                    heightMaterialTween.to({opacity:.8}, time).start();
                    bumpMaterialTween.to({opacity:1}, time).start();
                    heightMeshTween.to({y:20}, time).start();
                    bumpMeshTween.to({y:40}, time).start();
                    roadsMeshTween.to({y:60}, time).start();
                    waterMeshTween.to({y:80}, time).start();
                }else{
                    roads_sw.checked = false;
                    target.classList.remove("active");
                    setAnimStateBetween();
                    roadsMaterialTween.to({opacity:0}, time).start();
                    heightMaterialTween.to({opacity:0}, time).start();
                    bumpMaterialTween.to({opacity:0}, time).start();
                    heightMeshTween.to({y:0}, time).start();
                    bumpMeshTween.to({y:0}, time).start();
                    waterMeshTween.to({y:1.7}, time).start();
                    roadsMeshTween.to({y:.1}, time).start();
                }
            }
        });
    });

    //subcontrols
    auto_camera_sw.addEventListener("change", (e) => {
        controls.autoRotate = e.target.checked;
        auto = e.target.checked;
    });

    auto_time_sw.addEventListener("change", (e) => {
        if(e.target.checked){
            clearInterval(state_timer);
            let step_time = 3000;

            tween_animate(day_states[day_states[timestate].next_state], step_time);
            timestate = day_states[timestate].next_state;
            state_timer = setInterval(() => {
                tween_animate(day_states[day_states[timestate].next_state], step_time);
                timestate = day_states[timestate].next_state;
            }, step_time);
        }else{
            clearInterval(state_timer);
        }
    });

    map_type_sel.addEventListener("change", (e) => {
        if(e.target.value === 'satellite'){
            terrain_material.map = satellite_texture;
        }else if(e.target.value === 'terrain'){
            terrain_material.map = terrain_texture;
        }
    });

    water_sw.addEventListener("change", (e) => {
        water_material.opacity = (e.target.checked)? .5 : 0;
    });

    roads_sw.addEventListener("change", (e) => {
        roads_material.opacity = (e.target.checked)? 1 : 0;
    });

    bump_sw.addEventListener("change", (e) => {
        terrain_material.bumpScale = (e.target.checked)? 1 : 0;
    });
    
    shadow_sw.addEventListener("change", (e) => {
        dirLight.castShadow = e.target.checked;
    });
    
    setActiveState();
});
