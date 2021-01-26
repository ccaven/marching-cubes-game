
const shadows = (function () {
    let vsSource = `
    #version 300 es
    in vec4 a_position;
    uniform mat4 u_orthographic;
    uniform mat4 u_model;
    out float v_depth;
    void main () {
        gl_Position = u_orthographic * u_model * a_position;
        depth = gl_Position.z;
    }
    `;


    let fsSource = `
    #version 300 es
    in float v_depth;
    void main () {
        gl_FragColor = vec4(v_depth, 0, 0, 1);
    }
    `;

    vsSource = vsSource.trim();
    fsSource = fsSource.trim();

    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);

    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);

    let shadowProgram = gl.createProgram();
    gl.attachShader(shadowProgram, vertexShader);
    gl.attachShader(shadowProgram, fragmentShader);

    gl.bindAttribLocation(shadowProgram, 0, "a_position");

    gl.linkProgram(shadowProgram);

    const depthTextureSize = 512;

    let depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, depthTextureSize, depthTextureSize, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let depthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

    let projectionLocation = gl.getUniformLocation(shadowProgram, "u_orthographic");

    let modelLocation = gl.getUniformLocation(shadowProgram, "u_model");

    let positionLocation = gl.getUniformLocation(shadowProgram, "a_position");

    let orthographic = mat4.create();

    // Builds the orthographic matrix
    function constructOrthographicMatrix () {
        let amt = 100;

        let eye = vec3.fromValues(
            player.x - environment.lightDirection[0] * amt,
            player.y - environment.lightDirection[1] * amt,
            player.z - environment.lightDirection[2] * amt
        );

        let target = vec3.fromValues(
            player.x,
            player.y,
            player.z
        );

        let up = vec3.fromValues(0, 1, 0);

        mat4.lookAt(
            orthographic,
            eye,
            target,
            up
        );

        mat4.scale(orthographic, orthographic, vec3.fromValues(amt * 2, amt * 2, amt * 2));

        gl.uniformMatrix4fv(projectionLocation, false, orthographic);
    }

    function beginRenderingToShadow () {
        gl.useProgram(shadowProgram);

        constructOrthographicMatrix();

        gl.bindFramebuffer(depthFramebuffer);
    }

}) ();

