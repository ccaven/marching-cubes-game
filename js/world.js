
function mapDefinition (x, y, z) {
    return noise3D(x * 0.01, y * 0.01, z * 0.01) - 0.5 - (y ) * 0.01;
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

        this.mesh.setColorsByFunction((x, y, z) => {
            return vec3.fromValues(1.0, 1.0, 1.0);
        });

        this.mesh.setBuffers();
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
        let s = 5;

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
        if (!this.loadQueue.length) return;

        let chunk = this.loadQueue.shift();
        chunk.populateMap(mapDefinition);
        chunk.generateMesh();

        this.chunkReference[chunk.x + "," + chunk.z] = this.chunks.length;
        this.chunks.push(chunk);
    }

    render () {
        for (let i = 0; i < this.chunks.length; i ++) {
            this.chunks[i].render();
        }
    }

}
