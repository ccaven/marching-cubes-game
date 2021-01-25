
/* Constants */
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const ASPECT = WIDTH / HEIGHT;

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const INTERPOLATION = 1.0;
const RENDER_DISTANCE = 200;
const ISO_LEVEL = 0.0;
const PLAYER_SPEED = 0.1;
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
    lightDirection: vec3.fromValues(0.0, 1.0, 0.0)
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
    sensitivity: 1.0,
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

    /* Spherical hitbox */
    radius: 5.0,

    setCamera () {
        camera.x = this.x;
        camera.y = this.y;
        camera.z = this.z;

        camera.constructMatrix();
        camera.setMatrix();
    },

    controls () {
        camera.pitch += input.movementY * 0.001 * camera.sensitivity;
        camera.yaw += input.movementX * 0.001 * camera.sensitivity;

        if (input.keys.w) {
            this.velocity[0] += Math.sin(camera.yaw) * PLAYER_SPEED;
            this.velocity[2] -= Math.cos(camera.yaw) * PLAYER_SPEED;
        }

        if (input.keys.s) {
            this.velocity[0] -= Math.sin(camera.yaw) * PLAYER_SPEED;
            this.velocity[2] += Math.cos(camera.yaw) * PLAYER_SPEED;
        }

        if (input.keys.d) {
            this.velocity[0] += Math.cos(camera.yaw) * PLAYER_SPEED;
            this.velocity[2] += Math.sin(camera.yaw) * PLAYER_SPEED;
        }

        if (input.keys.a) {
            this.velocity[0] -= Math.cos(camera.yaw) * PLAYER_SPEED;
            this.velocity[2] -= Math.sin(camera.yaw) * PLAYER_SPEED;
        }

        if (input.keys[" "]) this.velocity[1] += PLAYER_SPEED;

        if (input.keys.shift) this.velocity[1] -= PLAYER_SPEED;

        this.velocity[0] *= 0.9;
        this.velocity[1] *= 0.9;
        this.velocity[2] *= 0.9;

        this.x += this.velocity[0];
        this.y += this.velocity[1];
        this.z += this.velocity[2];
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


    function render () {

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        player.controls();
        player.setCamera();

        if (!false) {
            world.fillLoadingQueue();
            world.loadChunks();

            world.render();
            world.collideWithPlayer();
        } else {
            box.render();
            box.collideWithPlayer();
        }

        // if (input.mouseDown) {
        //     let origin = vec3.fromValues(player.x, player.y, player.z);
        //     let direction = vec3.fromValues(camera.projectionMatrix[2], camera.projectionMatrix[6], camera.projectionMatrix[10]);

        //     console.log(origin, direction);
        //     let t = box.raycast(origin, direction);
        //     console.log(t);
        // }

        input.update();

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

}

main();


