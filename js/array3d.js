class Array3D {
    constructor (width, height, depth) {
        this.size = [width, height, depth];
        this.values = new Float32Array(this.size[0] * this.size[1] * this.size[2]);
    }

    getIndex (x, y, z) {
        let xA = 1;
        let yA = xA * this.size[0];
        let zA = yA * this.size[1];
        return xA * x + yA * y + zA * z;
    }

    get (x, y, z) {
        return this.values[this.getIndex(x, y, z)];
    }

    set (x, y, z, value) {
        this.values[this.getIndex(x, y, z)] = value;
    }

    fill (f, offset) {
        offset = offset || [0, 0, 0];
        for (let x = 0; x < this.size[0]; x ++) {
            for (let y = 0; y < this.size[1]; y ++) {
                for (let z = 0; z < this.size[2]; z ++) {
                    this.set(x, y, z, f(x + offset[0], y + offset[1], z + offset[2]));
                }
            }
        }
    }
}