'use strict';

// code based off https://github.com/mdn/webgl-examples/blob/gh-pages/tutorial/sample3/webgl-demo.js

function getWebGLContext(id) {
  var canvas = document.getElementById(id);
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!(gl && gl instanceof WebGLRenderingContext)) {
    throw "sorry, this browser does not support webgl"
  }

  console.log("this browser supports webgl")

  // Setup WebGL Viewport to the height and width of the canvas
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  // Enable the depth test
  gl.enable(gl.DEPTH_TEST);

  // Set the clear color
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // gl.clearColor(1.0, 1.0, 1.0, 1.0);
  
  // Clear the color buffer bit
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  
  // Clear the screen, using the color set above
  // gl.clear(gl.COLOR_BUFFER_BIT);

  return gl
}

// creates a shader of the given type, uploads the source and compiles it.
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // If compiling the shader failed, alert
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw 'An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// Initialize a shader program, so WebGL knows how to draw our data
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw 'Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram);
    return null;
  }

  return shaderProgram;
}

function initBuffers(gl, positions, velocities) {
  /* Position Buffer Setup */

  // create an empty buffer
  const positionBuffer = gl.createBuffer();
  // bind it to vertex buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // pass vertex data to currently bound buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  // unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  /* Velocity Buffer Setup */

  // create an empty buffer
  const velocityBuffer = gl.createBuffer();
  // bind it to vertex buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
  // pass vertex data to currently bound buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(velocities), gl.STATIC_DRAW);
  // unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    position: positionBuffer,
    velocity: velocityBuffer,
  };
}

function drawScene(gl, programInfo, buffers, vertexCount, deltaTime) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0; // byte offset between consecutive vertices
    const offset = 0;

    // specify the target for the buffer we made
    // target ARRAY_BUFFER = vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);

    // define an array of generic vertex attribute data
    gl.vertexAttribPointer(
        programInfo.attribLocations.position, // index
        numComponents, // size
        type,
        normalize,
        stride,
        offset);

    // enable the vertex array we just made above
    gl.enableVertexAttribArray(
        programInfo.attribLocations.position);
  }

  // Tell WebGL how to pull out the velocities from the velocity
  // buffer into the vertexPosition attribute
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0; // byte offset between consecutive vertices
    const offset = 0;

    // specify the target for the buffer we made
    // target ARRAY_BUFFER = vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.velocity);

    // define an array of generic vertex attribute data
    gl.vertexAttribPointer(
        programInfo.attribLocations.velocity, // index
        numComponents, // size
        type,
        normalize,
        stride,
        offset);

    // enable the vertex array we just made above
    gl.enableVertexAttribArray(
        programInfo.attribLocations.velocity);
  }

  // tell WebGL to use the program we made
  gl.useProgram(programInfo.program);

  gl.uniform1f(programInfo.uniformLocations.deltaTime, deltaTime)

  // setup the uniform variables
  /*
  gl.uniform1f(programInfo.uniformLocations.coolestTemp, 0)
  gl.uniform1f(programInfo.uniformLocations.tempRange, 2)
  gl.uniform3f(programInfo.uniformLocations.coolestColor, 0, 0, 1)
  gl.uniform3f(programInfo.uniformLocations.hottestColor, 1, 0, 0)
  */

  {
    const offset = 0;

    // draw the buffer data
    // params: mode, starting index, number of indices
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays
    gl.drawArrays(gl.Points, offset, vertexCount);
  }
}
