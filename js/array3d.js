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

    getInterpolated (x, y, z) {
        let x0 = Math.floor(x);
        let y0 = Math.floor(y);
        let z0 = Math.floor(z);

        let xd = x - x0;
        let yd = y - y0;
        let zd = z - z0;

        let c00 = this.get(x0, y0, z0) * (1 - xd) + this.get(x0 + 1, y0, z0) * xd;
        let c01 = this.get(x0, y0, z0 + 1) * (1 - xd) + this.get(x0 + 1, y0, z0 + 1) * xd;
        let c10 = this.get(x0, y0 + 1, z0) * (1 - xd) + this.get(x0 + 1, y0 + 1, z0);
        let c11 = this.get(x0, y0 + 1, z0 + 1) * (1 - xd) + this.get(x0 + 1, y0 + 1, z0 + 1);

        let c0 = c00 * (1 - yd) + c10 * yd;
        let c1 = c01 * (1 - yd) + c11 + yd;

        return c0 * (1 - zd) + c1 * zd;
    }
}