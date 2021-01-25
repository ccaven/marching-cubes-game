
class Mesh {

    static SMOOTH = 1;
    static FLAT = 2;
    static AUTOMATIC = 3;

    constructor(position, presetData={}) {
        this.position = position || vec3.fromValues(0, 0, 0);
        this.modelMatrix = mat4.create();
        mat4.translate(this.modelMatrix, this.modelMatrix, this.position);

        this.triangles = presetData.triangles || [];
        this.vertices = presetData.vertices || [];
        this.normals = presetData.normals || [];
        this.colors = presetData.colors || [];

        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();

        this.vertexArray = gl.createVertexArray();
        gl.bindVertexArray(this.vertexArray);
        program.enableAttributes();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(program.attribLocations.a_position.location, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(program.attribLocations.a_color.location, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(program.attribLocations.a_normal.location, 3, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);

        this.elastic = false;

    }

    setPosition(x, y, z) {
        this.position.set(arguments, 0);
        mat4.translate(this.modelMatrix, mat4.create(), this.position);
    }

    setVertices(vertices) {
        this.vertices = vertices;
    }

    setTriangles(triangles=Mesh.AUTOMATIC) {
        if (triangles == Mesh.AUTOMATIC) this.triangles = (new Uint16Array(this.vertices.length / 3)).map((e, i) => i);
        else this.triangles = triangles;
    }

    setBuffers() {
        gl.bindVertexArray(this.vertexArray);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.triangles, gl.STATIC_DRAW);

        gl.bindVertexArray(null);
    }

    setNormals(normals=Mesh.FLAT) {
        if (normals === Mesh.FLAT) {
            // Generate flat shading
            this.normals = new Float32Array(this.vertices.length);

            for (let i = 0; i < this.normals.length; i += 9) {

                let [i1, i2, i3] = this.triangles.slice(i / 3, i / 3 + 3);

                let v1 = this.vertices.slice(i1 * 3, i1 * 3 + 3);
                let v2 = this.vertices.slice(i2 * 3, i2 * 3 + 3);
                let v3 = this.vertices.slice(i3 * 3, i3 * 3 + 3);

                vec3.sub(v1, v1, v2);
                vec3.sub(v2, v2, v3);
                vec3.cross(v1, v1, v2);
                vec3.normalize(v1, v1);

                this.normals.set(v1, i);
                this.normals.set(v1, i + 3);
                this.normals.set(v1, i + 6);
            }

        } else this.normals = normals;

    }

    setColorsByFunction(f) {
        this.colors = new Float32Array(this.vertices.length);

        for (let i = 0; i < this.colors.length; i += 9) {
            let avgX = this.vertices[i + 0] + this.vertices[i + 3] + this.vertices[i + 6];
            let avgY = this.vertices[i + 1] + this.vertices[i + 4] + this.vertices[i + 7];
            let avgZ = this.vertices[i + 2] + this.vertices[i + 5] + this.vertices[i + 8];

            let c = f(avgX / 3 + this.position[0], avgY / 3 + this.position[1], avgZ / 3 + this.position[2]);

            this.colors.set(c, i);
            this.colors.set(c, i + 3);
            this.colors.set(c, i + 6);

        }
    }

    collideWithPlayer () {

        let px = player.x - this.position[0];
        let py = player.y - this.position[1];
        let pz = player.z - this.position[2];

        const n = this.triangles.length;
        for (let i = 0; i < n; i += 3) {

            // Calculate triangle indices
            let [i0, i1, i2] = this.triangles.slice(i, i + 3);

            // Calculate triangle normal
            let [normalX, normalY, normalZ] = this.normals.slice(i0 * 3, i0 * 3 + 3);

            // Calculate triangle vertices
            let [v0x, v0y, v0z] = this.vertices.slice(i0 * 3, i0 * 3 + 3);
            let [v1x, v1y, v1z] = this.vertices.slice(i1 * 3, i1 * 3 + 3);
            let [v2x, v2y, v2z] = this.vertices.slice(i2 * 3, i2 * 3 + 3);

            // Calculate triangle diagonals
            let [d0x, d0y, d0z] = [v1x - v0x, v1y - v0y, v1z - v0z];
            let [d1x, d1y, d1z] = [v2x - v0x, v2y - v0y, v2z - v0z];

            // Calculate local point
            let [localX, localY, localZ] = [px - v0x, py - v0y, pz - v0z];

            // Calculate closest point on plane
            let [planeX, planeY, planeZ] = projectToPlane(localX, localY, localZ, normalX, normalY, normalZ);

            // Calculate uv coordinates
            let u = planeX * d0x + planeY * d0y + planeZ * d0z;
            let v = planeX * d1x + planeY * d1y + planeZ * d1z;
            [u, v] = snapToTriangle(u, v);

            // Calculate closest point
            let [cx, cy, cz] = [
                v0x + d0x * u + d1x * v,
                v0y + d0y * u + d1y * v,
                v0z + d0z * u + d1z * v
            ];

            // Calculate vector pointing towards player
            let [dx, dy, dz] = [px - cx, py - cy, pz - cz];

            // Calculate distance squared
            let dstSquared = dx * dx + dy * dy + dz * dz;

            if (dstSquared < player.radius * player.radius) {

                let dst = Math.sqrt(dstSquared);

                // Correct position
                player.x = this.position[0] + cx + dx / dst * player.radius;
                player.y = this.position[1] + cy + dy / dst * player.radius;
                player.z = this.position[2] + cz + dz / dst * player.radius;

                // Calculate friction
                dst = 1 / dst;
                [dx, dy, dz] = [dx * dst, dy * dst, dz * dst];

                /*
                let [ix, iy, iz] = player.velocity;
                let f_normal = -(ix * dx + iy * dy + iz * dz);
                let mu = 0.2;
                */

                // Correct velocity
                let dp = dx * player.velocity[0] + dy * player.velocity[1] + dz * player.velocity[2];
                dp *= (this.elastic + 1.0);

                player.velocity[0] -= dp * dx;
                player.velocity[1] -= dp * dy;
                player.velocity[2] -= dp * dz;

                // Apply friction
                /*
                let im = Math.sqrt(ix * ix + iy * iy + iz * iz);
                if (im > 0) {
                    im = 1.0 / Math.sqrt(im);
                    player.velocity[0] -= ix * im * f_normal * mu;
                    player.velocity[1] -= iy * im * f_normal * mu;
                    player.velocity[2] -= iz * im * f_normal * mu;
                }
                */

            }
        }
    }

    render() {
        gl.uniformMatrix4fv(program.uniformLocations.m_matrix.location, false, this.modelMatrix);
        gl.bindVertexArray(this.vertexArray);
        gl.drawElements(gl.TRIANGLES, this.triangles.length, gl.UNSIGNED_SHORT, 0);
    }

    raycast(origin, direction) {
        vec3.sub(origin, origin, this.position);

        let minDist = null;

        for (let i = 0; i < this.triangles.length; i += 3) {
            let [i0, i1, i2] = this.triangles.slice(i, i + 3);

            let d = intersectTriangle(origin, direction,
                this.vertices.slice(i0 * 3, i0 * 3 + 3),
                this.vertices.slice(i1 * 3, i1 * 3 + 3),
                this.vertices.slice(i2 * 3, i2 * 3 + 3));

            if (d) {
                console.log(d);

                if (!minDist) minDist = d;
                else if (d < minDist) minDist = d;
            }
        }

        return minDist;
    }
}


let intersectTriangle = (function () {
    let v1v0 = vec3.create();
    var v2v0 = vec3.create();

    var n = vec3.create();
    var q = vec3.create();

    return function (ro, rd, v0, v1, v2) {
        vec3.sub(v1v0, v1, v0);
        vec3.sub(v2v0, v2, v0);

        vec3.cross(q, rd, v2v0);
        let det = vec3.dot(v1v0, q);
        let invDet = 1 / det;

        vec3.sub(n, ro, v0);
        let u = vec3.dot(n, q) * invDet;
        if (u < 0 || u > 1) return null;

        vec3.cross(q, n, v1v0);
        let v = vec3.dot(rd, q) * invDet;
        if (v < 0 || u + v > 1) return null;

        return vec3.dot(v2v0, q) * invDet;
    };
}) ();

function projectToPlane (localX, localY, localZ, normalX, normalY, normalZ) {
    let d = localX * normalX + localY * normalY + localZ * normalZ;
    return [
        localX - d * normalX,
        localY - d * normalY,
        localZ - d * normalZ
    ];
}

function snapToTriangle (u, v) {
    let d = Math.max((u + v - 1.0) / 2.0, 0.0);
    return [
        clamp01(u - d),
        clamp01(v - d)
    ];
}