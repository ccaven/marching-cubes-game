
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

let triangleSDF = (function () {

    /* TOOD: finish copying glsl sdf */

    let ba = vec3.create();
    let pa = vec3.create();

    let cb = vec3.create();
    let pb = vec3.create();

    let ac = vec3.create();
    let pc = vec3.create();

    let nor = vec3.create();

    return function (p, a, b, c) {
        vec3.sub(ba, b, a);
        vec3.sub(pa, p, a);
        vec3.sub(cb, c, b);
        vec3.sub(pb, p, b);
        vec3.sub(ac, a, c);
        vec3.sub(pc, p, c);

        vec3.cross(nor, ba, ac);

        let conditional = Math.sign(vec3.dot(vec3.cross(ba, nor), pa)) + Math.sign(vec3.dot(vec3.cross(cb, nor), pb)) + Math.sign(vec3.dot(vec3.cross(ac, nor), pc)) < 2.0;

        if (conditional) {



        }
    };
}) ();

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

        this.mesh.setColorsByFunction((x, y, z) => {
            return vec3.fromValues(1.0, 1.0, 1.0);
        });

        this.mesh.setBuffers();
    }

    collideWithPlayer () {

        // local reference
        let tris = this.mesh.triangles;
        let verts = this.mesh.vertices;

        let v0 = vec3.create();
        let v1 = vec3.create();
        let v2 = vec3.create();

        for (let i = 0; i < tris.length; i += 3) {

            vec3.set(v0, verts[tris[i]*3], verts[tris[i]*3+1], verts[tris[i]*3+2]);
            vec3.set(v0, verts[tris[i+1]*3], verts[tris[i+1]*3+1], verts[tris[i+1]*3+2]);
            vec3.set(v0, verts[tris[i+2]*3], verts[tris[i+2]*3+1], verts[tris[i+2]*3+2]);

            // check for collision


        }

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

                    let chunk = this.chunks[chunkIndex];

                    let t = chunk.mesh.raycast(ro, rd);

                    console.log(t);

                    if (t && t > 0 && (mt < 0 || mt > t)) mt = t;
                }
            }
        }

        return mt > 0 ? mt : null;
    }

    render () {
        for (let i = 0; i < this.chunks.length; i ++) {
            this.chunks[i].render();
        }
    }

}
