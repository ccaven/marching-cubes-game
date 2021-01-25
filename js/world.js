
function smoothMin (a, b, k) {
    let h = Math.min(Math.max((b - a + k) / 2 / k, 0.0), 1.0);
    return a * h + b * (1 - h) - k * h * (1 - h);
}

const CRATER_COEFFICIENTS = {
    c1: 2.0,
    c2: 0.975,
    c3: 0.0
};

function craterHeight (d) {
    let a = CRATER_COEFFICIENTS.c1 * d * d - 1.0;
    let b = CRATER_COEFFICIENTS.c2 * 1 / (d * 2);
    let c = CRATER_COEFFICIENTS.c3;

    if (d < 0.001) return c;

    return smoothMin(smoothMin(a, b, 0.2), c, -0.2);
}

function mapDefinition (x, y, z) {

    let v = -y + 5;

    if (Math.abs(v) < 20.0) v += (noise3D(x * 0.01, y * 0.01, z * 0.01) - 0.5) * 20;

    if (Math.abs(v) < 10.0) v += (noise3D(x * 0.05, y * 0.05, z * 0.05) - 0.5) * 10;

    if (Math.abs(v) < 40.0) v += craterHeight(Math.sqrt(x * x + z * z) * 0.05) * 20.0;

    return v;
}

function mapGradient (x, y, z) {
    const h = 0.001;
    return vec3.fromValues(

        (mapDefinition(x + h, y, z) - mapDefinition(x - h, y, z)) / h * 0.5,
        (mapDefinition(x, y + h, z) - mapDefinition(x, y - h, z)) / h * 0.5,
        (mapDefinition(x, y, z + h) - mapDefinition(x, y, z - h)) / h * 0.5,

    );
}

const palette = {
    greyDark : vec3.fromValues(0.075, 0.05, 0.1),
    greyMedium : vec3.fromValues(0.3, 0.4, 0.5),
    greyLight : vec3.fromValues(0.6, 0.7, 0.75),
    greyExtra : vec3.fromValues(0.89, 0.9, 0.88),
    blueDark : vec3.fromValues(0.0, 0.2, 0.4),
    blueMedium : vec3.fromValues(0.1, 0.35, 0.6),
    blueLight : vec3.fromValues(0.25, 0.5, 0.7),
    turquoiseDark : vec3.fromValues(0.2, 0.4, 0.5),
    turquoiseMedium : vec3.fromValues(0.3, 0.55, 0.6),
    turquoiseLight : vec3.fromValues(0.45, 0.7, 0.65),
    greenDark : vec3.fromValues(0.2, 0.45, 0.35),
    greenMedium : vec3.fromValues(0.35, 0.6, 0.4),
    greenLight : vec3.fromValues(0.6, 0.8, 0.5),
    greenExtra : vec3.fromValues(0.75, 0.9, 0.55),
    pinkDark : vec3.fromValues(0.45, 0.25, 0.6),
    pinkMedium : vec3.fromValues(0.6, 0.3, 0.6),
    pinkLight : vec3.fromValues(0.7, 0.4, 0.65),
    pinkExtra : vec3.fromValues(0.8, 0.5, 0.65)
};


function colorDefinition (x, y, z) {

    let n = noise3D(x * 0.05, y * 0.05, z * 0.05);

    // Purple Rock
    if (n > 0.5) {

        let n2 = noise3D(x * 0.05 + 100, y * 0.05, z * 0.05 + 100);
        return n2 > 0.5 ? palette.pinkDark : palette.pinkMedium;

    }

    // Gray rock
    else {
        let n2 = noise3D(x * 0.05 + 100, y * 0.05, z * 0.05 + 100);
        return n2 > 0.5 ? palette.greyLight : palette.greyMedium;
    }

}

function clamp01 (x) {
    return Math.max(Math.min(x, 1.0), 0.0);
}

class Chunk {
    constructor (x, z) {

        this.x = x;
        this.y = -CHUNK_HEIGHT / 2;
        this.z = z;

        this.mesh = new Mesh([this.x, this.y, this.z]);

        this.generator = new MarchingCubes(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
    }

    populateMap (f) {
        this.generator.fillVoxels(f, this.mesh.position);
    }

    generateMesh () {
        this.generator.fillMesh(this.mesh);

        this.mesh.setColorsByFunction(colorDefinition);

        this.mesh.setBuffers();
    }

    collideWithPlayer () {
        // Check bounding box

        if (Math.abs(player.x - this.x + CHUNK_SIZE / 2.0) > CHUNK_SIZE / 2.0 + player.radius) return;
        if (Math.abs(player.z - this.z + CHUNK_SIZE / 2.0) > CHUNK_SIZE / 2.0 + player.radius) return;

        this.mesh.collideWithPlayer();

    }

    render () {
        this.mesh.render();
    }
}

class World {

    constructor () {

        this.chunks = [];
        this.chunkReference = {};
        this.loadQueue = [];

    }

    addChunkToLoadingQueue (x, z) {
        this.chunkReference[x + "," + z] = -1;
        this.loadQueue.push(new Chunk(x, z));
    }

    chunkExists (x, z) {
        return this.chunkReference.hasOwnProperty(x + "," + z);
    }

    fillLoadingQueue () {
        let s = 10;

        let px = Math.floor(player.x / CHUNK_SIZE) * CHUNK_SIZE;
        let pz = Math.floor(player.z / CHUNK_SIZE) * CHUNK_SIZE;

        for (let dx = -s; dx <= s; dx ++) {
            for (let dz = -s; dz <= s; dz ++) {

                let x = px + dx * CHUNK_SIZE;
                let z = pz + dz * CHUNK_SIZE;

                if (!this.chunkExists(x, z)) this.addChunkToLoadingQueue(x, z);

            }
        }

        this.sortLoadingQueue();
    }

    sortLoadingQueue () {

        this.loadQueue.sort((a, b) => {
            let x0 = a.x + CHUNK_SIZE / 2 - player.x;
            let z0 = a.z + CHUNK_SIZE / 2 - player.z;

            let x1 = b.x + CHUNK_SIZE / 2 - player.x;
            let z1 = b.z + CHUNK_SIZE / 2 - player.z;

            return x0 * x0 + z0 * z0 - x1 * x1 - z1 * z1;
        })

    }

    loadChunks () {
        const numLoad = 1;
        for (let i = 0; i < numLoad; i ++) {
            if (!this.loadQueue.length) return;

            let chunk = this.loadQueue.shift();
            chunk.populateMap(mapDefinition);
            chunk.generateMesh();

            this.chunkReference[chunk.x + "," + chunk.z] = this.chunks.length;
            this.chunks.push(chunk);
        }
    }

    raycast () {

        let ro = vec3.fromValues(player.x, player.y, player.z);
        let rd = vec3.fromValues(
            camera.projectionMatrix[2],
            camera.projectionMatrix[6],
            camera.projectionMatrix[10]
        );

        let px = Math.floor(player.x / CHUNK_SIZE) * CHUNK_SIZE;
        let pz = Math.floor(player.z / CHUNK_SIZE) * CHUNK_SIZE;

        let mt = -1;

        for (let dx = -1; dx <= 1; dx ++) {
            for (let dz = -1; dz <= 1; dz ++) {

                let cx = px + dx * CHUNK_SIZE;
                let cz = pz + dz * CHUNK_SIZE;

                if (this.chunkExists(cx, cz)) {

                    let referenceIndex = cx + "," + cz;

                    let chunkIndex = this.chunkReference[referenceIndex];

                    if (chunkIndex >= 0) {
                        let chunk = this.chunks[chunkIndex];

                        let t = chunk.mesh.raycast(ro, rd);

                        console.log(t);

                        if (t && (mt < 0 || mt > t)) mt = t;
                    }
                }
            }
        }

        return mt > 0 ? mt : null;
    }

    collideWithPlayer () {

        let px = Math.floor(player.x / CHUNK_SIZE) * CHUNK_SIZE;
        let pz = Math.floor(player.z / CHUNK_SIZE) * CHUNK_SIZE;

        for (let dx = -1; dx <= 1; dx ++) {
            for (let dz = -1; dz <= 1; dz ++) {

                let cx = px + dx * CHUNK_SIZE;
                let cz = pz + dz * CHUNK_SIZE;

                if (this.chunkExists(cx, cz)) {

                    let chunkIndex = this.chunkReference[cx + "," + cz];

                    if (chunkIndex >= 0) {
                        this.chunks[chunkIndex].mesh.collideWithPlayer();
                    }
                }
            }
        }

    }

    render () {
        for (let i = 0; i < this.chunks.length; i ++) {
            this.chunks[i].render();
        }
    }

}
