
class Mesh {

    static SMOOTH = 1;
    static FLAT = 2;
    static AUTOMATIC = 3;

    constructor(position, rotation) {
        this.position = position || vec3.fromValues(0, 0, 0);
        this.modelMatrix = mat4.create();
        mat4.translate(this.modelMatrix, this.modelMatrix, this.position);

        this.triangles = [];
        this.vertices = [];
        this.normals = [];
        this.colors = [];

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

    }

    setVertices(vertices) {
        this.vertices = vertices;
    }

    setTriangles(triangles=Mesh.AUTOMATIC) {
        if (triangles === Mesh.AUTOMATIC) {
            this.triangles = new Uint16Array(this.vertices.length / 3);
            for (let i = 0; i < this.triangles.length; i ++) this.triangles[i] = i;
        } else this.triangles = triangles;
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

        if(normals === Mesh.SMOOTH) {

            // Generate smooth shading

        } else if (normals === Mesh.FLAT) {

            // Generate flat shading
            this.normals = new Float32Array(this.vertices.length);
            for (let i = 0; i < this.normals.length; i += 3) {
                let i1 = this.triangles[(i/9|0)*3];
                let i2 = this.triangles[(i/9|0)*3+1];
                let i3 = this.triangles[(i/9|0)*3+2];

                let v1 = vec3.fromValues(this.vertices[i1*3], this.vertices[i1*3+1], this.vertices[i1*3+2]);
                let v2 = vec3.fromValues(this.vertices[i2*3], this.vertices[i2*3+1], this.vertices[i2*3+2]);
                let v3 = vec3.fromValues(this.vertices[i3*3], this.vertices[i3*3+1], this.vertices[i3*3+2]);

                vec3.sub(v1, v1, v2);
                vec3.sub(v2, v2, v3);
                vec3.cross(v1, v1, v2);
                vec3.normalize(v1, v1);

                this.normals[i] = v1[0];
                this.normals[i+1] = v1[1];
                this.normals[i+2] = v1[2];
            }

        } else this.normals = normals;

    }

    setColorsByFunction(f) {
        this.colors = new Float32Array(this.vertices.length);

        for (let i = 0; i < this.colors.length; i += 9) {
            let j = (i / 9 | 0) * 3;

            let avgX = this.vertices[j*3+0] + this.vertices[j*3+3] + this.vertices[j*3+6];
            let avgY = this.vertices[j*3+1] + this.vertices[j*3+4] + this.vertices[j*3+7];
            let avgZ = this.vertices[j*3+2] + this.vertices[j*3+5] + this.vertices[j*3+8];

            avgX *= 0.333;
            avgY *= 0.333;
            avgZ *= 0.333;

            let c = f(avgX + this.position[0], avgY + this.position[1], avgZ + this.position[2]);

            this.colors[i] = c[0];
            this.colors[i+1] = c[1];
            this.colors[i+2] = c[2];

            this.colors[i+3] = c[0];
            this.colors[i+4] = c[1];
            this.colors[i+5] = c[2];

            this.colors[i+6] = c[0];
            this.colors[i+7] = c[1];
            this.colors[i+8] = c[2];
        }
    }

    render() {
        gl.uniformMatrix4fv(program.uniformLocations.m_matrix.location, false, this.modelMatrix);
        gl.bindVertexArray(this.vertexArray);
        gl.drawElements(gl.TRIANGLES, this.triangles.length, gl.UNSIGNED_SHORT, 0);
    }
}