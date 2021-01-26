
/* Constants */
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const ASPECT = WIDTH / HEIGHT;

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const INTERPOLATION = 1.0;
const RENDER_DISTANCE = 200;
const ISO_LEVEL = 0.0;
const PLAYER_SPEED = 30.0;
const SCALE = 1.0;
const OFFSET = vec3.fromValues(0, 0, 0);

/** @type {HTMLCanvasElement} */
const glCanvas = getCanvas("gl-canvas", WIDTH, HEIGHT);
const gl = glCanvas.getContext("webgl2");

/** @type {HTMLCanvasElement} */
const ctxCanvas = getCanvas("ui-canvas", WIDTH, HEIGHT);
const ctx = ctxCanvas.getContext("2d");

/* Terrain program */
const program = createProgramObject(gl, "terrain.vsh", "terrain.fsh");

/* Holds environment variables */
const environment = {
    clock: 0.0,
    lightDirection: vec3.fromValues(0.0, 1.0, 0.0),
};

/* Handles input */
const input = {
    mouseX: 0, mouseY: 0,
    movementX: 0, movementY: 0,
    mouseDown: false, mouseButton: 0, mouseLocked: false,
    keys: {},
    initialize () {
        let self = this;
        ctxCanvas.onmousedown = function (e) {
            self.mouseButton = e.button;
            self.mouseDown = true;

            if (!self.mouseLocked) {
                if (ctxCanvas.requestPointerLock) {
                    ctxCanvas.requestPointerLock();
                    self.mouseLocked = true;
                } else if (ctxCanvas.mozRequestPointerLock) {
                    ctxCanvas.mozRequestPointerLock();
                    self.mouseLocked = true;
                } else if (ctxCanvas.webkitRequestPointerLock) {
                    ctxCanvas.webkitRequestPointerLock();
                    self.mouseLocked = true;
                }
            }

        };
        ctxCanvas.onmouseup = function (e) {
            self.mouseDown = false;
        }
        ctxCanvas.onmousemove = function (e) {
            self.mouseX = e.x;
            self.mouseY = e.y;
            self.movementX += e.movementX;
            self.movementY += e.movementY;
        };
        document.onkeydown = function (e) {
            self.keys[e.key.toLowerCase()] = true;
        };
        document.onkeyup = function (e) {
            self.keys[e.key.toLowerCase()] = false;
        };
    },
    update () {
        this.movementX = 0;
        this.movementY = 0;
    }
};

/* Handles statistics */
const statistics = {
    deltaTime: 0.0,
    lastTime: 0.0,
    currentTime: 0.0,
    lastFrameTime: 0.0,
    fps: 60.0,
    chunksRendered: 0,
    update(now) {
        this.currentTime = now;
        this.deltaTime = this.currentTime - this.lastTime;
        this.lastTime = this.currentTime;

        if (now - this.lastFrameTime > 1000) {
            this.fps = 1000.0 / this.deltaTime;
            this.lastFrameTime = now;
        }
    }
};

/* Handles camera */
const camera = {
    x: 0, y: 0, z: 0,
    pitch: 0.0,
    yaw: 0.0,
    FOV: Math.PI * 0.50,
    zNear: 0.3,
    zFar: 300.0,
    sensitivity: 0.05,
    projectionMatrix: mat4.create(),
    constructMatrix() {
        mat4.perspective(this.projectionMatrix, this.FOV, ASPECT, this.zNear, this.zFar);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.pitch, [1, 0, 0]);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.yaw, [0, 1, 0]);
        mat4.translate(this.projectionMatrix, this.projectionMatrix, [-this.x, -this.y, -this.z]);
    },

    setMatrix() {
        gl.uniformMatrix4fv(program.uniformLocations.u_matrix.location, false, camera.projectionMatrix);
    },
};

const player = {
    x: 0, y: 10, z: 0,
    velocity: vec3.fromValues(0, 0, 0),
    acceleration: vec3.fromValues(0, 0, 0),

    /* Spherical hitbox */
    radius: 5.0,
    mass: 1.0,

    setCamera () {
        camera.x = this.x;
        camera.y = this.y;
        camera.z = this.z;

        camera.constructMatrix();
        camera.setMatrix();
    },

    applyForce (x, y, z) {
        this.acceleration[0] += x / this.mass;
        this.acceleration[1] += y / this.mass;
        this.acceleration[2] += z / this.mass;
    },

    controls (dt) {
        camera.pitch += input.movementY * dt * camera.sensitivity;
        camera.yaw += input.movementX * dt * camera.sensitivity;

        let ct = Math.cos(camera.yaw) * PLAYER_SPEED;
        let st = Math.sin(camera.yaw) * PLAYER_SPEED;

        if (input.keys.w) this.applyForce(st, 0, -ct);
        if (input.keys.a) this.applyForce(-ct, 0, -st);
        if (input.keys.s) this.applyForce(-st, 0, ct);
        if (input.keys.d) this.applyForce(ct, 0, st);

        if (input.keys[" "]) this.applyForce(0, PLAYER_SPEED, 0);

        if (input.keys.shift) this.applyForce(0, -PLAYER_SPEED, 0);

        this.applyForce(0, -9.81 * this.mass, 0);

        this.velocity[0] += this.acceleration[0] * dt;
        this.velocity[1] += this.acceleration[1] * dt;
        this.velocity[2] += this.acceleration[2] * dt;

        this.acceleration[0] = 0;
        this.acceleration[1] = 0;
        this.acceleration[2] = 0;

        const n = 3;
        for (let i = 0; i < n; i ++) {

            world.collideWithPlayer();
            this.x += dt * this.velocity[0] / n;
            this.y += dt * this.velocity[1] / n;
            this.z += dt * this.velocity[2] / n;

        }
    }

};

const world = new World();

function main () {
    gl.viewport(0, 0, WIDTH, HEIGHT);
    gl.clearColor(0.5, 0.5, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(program.program);

    camera.constructMatrix();
    camera.setMatrix();
    input.initialize();

    world.fillLoadingQueue();
    world.loadChunks();


    let box = parseObj(BOX_OBJ);
    box.setPosition(0, 10, 0);
    box.setNormals(Mesh.FLAT);
    box.setColorsByFunction(() => vec3.fromValues(0.8, 0.8, 0.8));
    box.setBuffers();


    let then = 0;
    function render (now) {
        let dt = (now - then) * 0.001;
        then = now;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        player.controls(dt);
        player.setCamera();

        world.fillLoadingQueue();
        world.loadChunks();

        world.render();


        if (input.mouseDown) {
            let origin = vec3.fromValues(player.x, player.y, player.z);
            let direction = vec3.fromValues(camera.projectionMatrix[2], camera.projectionMatrix[6], camera.projectionMatrix[10]);

            console.log(origin, direction);
            let t = world.raycast();
            console.log(t);
        }

        input.update();

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

}

main();


