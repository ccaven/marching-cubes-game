
/* Constants */
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const ASPECT = WIDTH / HEIGHT;

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const INTERPOLATION = 1.0;
const RENDER_DISTANCE = 200;
const ISO_LEVEL = 0.0;
const PLAYER_SPEED = 0.25;
const SCALE = 1.0;
const OFFSET = vec3.fromValues(0, 0, 0);

const glCanvas = getCanvas("gl-canvas", WIDTH, HEIGHT);
const gl = glCanvas.getContext("webgl2");

const ctxCanvas = getCanvas("ui-canvas", WIDTH, HEIGHT);
const ctx = ctxCanvas.getContext("2d");

/* Terrain program */
const program = createProgramObject(gl, "terrain.vsh", "terrain.fsh");
console.log(program);
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
    x: 0, y: 0, z: 10,
    pitch: 0.0,
    yaw: 0.0,
    FOV: Math.PI * 0.50,
    zNear: 0.3,
    zFar: 100.0,
    sensitivity: 1.0,
    constructMatrix() {
        this.projectionMatrix = mat4.create();
        mat4.perspective(this.projectionMatrix, this.FOV, ASPECT, this.zNear, this.zFar);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.pitch, [1, 0, 0]);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.yaw, [0, 1, 0]);
        mat4.translate(this.projectionMatrix, this.projectionMatrix, [-this.x, -this.y, -this.z]);
    },

    setMatrix() {
        gl.uniformMatrix4fv(program.uniformLocations.u_matrix.location, false, camera.projectionMatrix);
    },

    controls() {
        this.pitch += input.movementY * 0.001 * this.sensitivity;
        this.yaw += input.movementX * 0.001 * this.sensitivity;

        if (input.keys.w) {
            this.x += Math.sin(this.yaw) * PLAYER_SPEED;
            this.z -= Math.cos(this.yaw) * PLAYER_SPEED;
        }

        if (input.keys.s) {
            this.x -= Math.sin(this.yaw) * PLAYER_SPEED;
            this.z += Math.cos(this.yaw) * PLAYER_SPEED;
        }

        if (input.keys.d) {
            this.x += Math.cos(this.yaw) * PLAYER_SPEED;
            this.z += Math.sin(this.yaw) * PLAYER_SPEED;
        }

        if (input.keys.a) {
            this.x -= Math.cos(this.yaw) * PLAYER_SPEED;
            this.z -= Math.sin(this.yaw) * PLAYER_SPEED;
        }

        if (input.keys[" "])
            this.y += PLAYER_SPEED;

        if (input.keys.shift)
            this.y -= PLAYER_SPEED;
    },
};

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

    let mesh = new Mesh(vec3.fromValues(-8, -8, -8));

    let marchingCubes = new MarchingCubes(16, 64, 16);
    marchingCubes.fillVoxels((x, y, z) => noiseGenerator.noise3D(x * 0.05, y * 0.05, z * 0.05, 8) - 0.5);
    marchingCubes.fillMesh(mesh)

    mesh.setColorsByFunction((x, y, z) => {
        return vec3.fromValues(1.0, 1.0, 1.0);
    });

    mesh.setBuffers();

    function render () {

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        camera.controls();
        camera.constructMatrix();
        camera.setMatrix();

        mesh.render();
        input.update();

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

}

main();

