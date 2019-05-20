'use strict';

// -- Init Canvas
const canvas = document.getElementById('transform-feedback');

// -- Init WebGL Context
const gl = canvas.getContext('webgl2', { antialias: false });
var isWebGL2 = !!gl;
if(!isWebGL2)
{
    throw 'WebGL 2 is not available'
}

canvas.addEventListener("webglcontextlost", function(event) {
    event.preventDefault();
}, false);

// -- Declare variables for the particle system

// var NUM_PARTICLES = 1000000;
var NUM_PARTICLES = 10;
var ACCELERATION = 0;

var appStartTime = Date.now();
var currentSourceIdx = 0;

var calcProgram = initCalcProgram('vs-calc', 'fs-calc');
var viewProgram = initViewProgram('vs-draw', 'fs-draw');

// Get uniform locations for the calc program
var drawTimeLocation = gl.getUniformLocation(calcProgram, 'u_time');
var drawColorLocation = gl.getUniformLocation(calcProgram, 'u_color');

// -- Initialize particle data

var particlePositions = new Float32Array(NUM_PARTICLES * 2);
var particleVelocities = new Float32Array(NUM_PARTICLES * 2);
var particleSpawntime = new Float32Array(NUM_PARTICLES);
var particleLifetime = new Float32Array(NUM_PARTICLES);
var particleIDs = new Float32Array(NUM_PARTICLES);

var POSITION_LOCATION = 0;
var VELOCITY_LOCATION = 1;
var SPAWNTIME_LOCATION = 2;
var LIFETIME_LOCATION = 3;
var ID_LOCATION = 4;
var NUM_LOCATIONS = 5;

for (var p = 0; p < NUM_PARTICLES; ++p) {
    particlePositions[p * 2] = 0.0; // x position
    particlePositions[p * 2 + 1] = 0.0; // y position
    particleVelocities[p * 2] = 0.0; // x velocity
    particleVelocities[p * 2 + 1] = 0.0; // y velocity
    particleSpawntime[p] = 0.0;
    particleLifetime[p] = 0.0;
    particleIDs[p] = p;
}

// -- Init Vertex Arrays and Buffers
var particleVAOs = [gl.createVertexArray(), gl.createVertexArray()];

// Transform feedback objects track output buffer state
var particleTransformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];

var particleVBOs = new Array(particleVAOs.length);

for (var i = 0; i < particleVAOs.length; ++i) {
    particleVBOs[i] = new Array(NUM_LOCATIONS);

    // Set up input
    gl.bindVertexArray(particleVAOs[i]);

    particleVBOs[i][POSITION_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][POSITION_LOCATION]);
    gl.bufferData(gl.ARRAY_BUFFER, particlePositions, gl.STREAM_COPY);
    gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(POSITION_LOCATION);

    particleVBOs[i][VELOCITY_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][VELOCITY_LOCATION]);
    gl.bufferData(gl.ARRAY_BUFFER, particleVelocities, gl.STREAM_COPY);
    gl.vertexAttribPointer(VELOCITY_LOCATION, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(VELOCITY_LOCATION);

    particleVBOs[i][SPAWNTIME_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][SPAWNTIME_LOCATION]);
    gl.bufferData(gl.ARRAY_BUFFER, particleSpawntime, gl.STREAM_COPY);
    gl.vertexAttribPointer(SPAWNTIME_LOCATION, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(SPAWNTIME_LOCATION);

    particleVBOs[i][LIFETIME_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][LIFETIME_LOCATION]);
    gl.bufferData(gl.ARRAY_BUFFER, particleLifetime, gl.STREAM_COPY);
    gl.vertexAttribPointer(LIFETIME_LOCATION, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(LIFETIME_LOCATION);

    particleVBOs[i][ID_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][ID_LOCATION]);
    gl.bufferData(gl.ARRAY_BUFFER, particleIDs, gl.STATIC_READ);
    gl.vertexAttribPointer(ID_LOCATION, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(ID_LOCATION);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    // Set up output
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, particleTransformFeedbacks[i]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particleVBOs[i][POSITION_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, particleVBOs[i][VELOCITY_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, particleVBOs[i][SPAWNTIME_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, particleVBOs[i][LIFETIME_LOCATION]);

}

function initViewProgram(vertShader, fragShader) {
    // Setup viewProgram for viewing calc results
    function createShader(gl, source, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    var vshader = createShader(gl, getShaderSource(vertShader), gl.VERTEX_SHADER);
    var fshader = createShader(gl, getShaderSource(fragShader), gl.FRAGMENT_SHADER);

    var viewProgram = gl.createProgram();
    gl.attachShader(viewProgram, vshader);
    gl.attachShader(viewProgram, fshader);

    gl.linkProgram(viewProgram);

    // check
    var log = gl.getProgramInfoLog(viewProgram);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(vshader);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(fshader);
    if (log) {
        console.log(log);
    }

    gl.deleteShader(vshader);
    gl.deleteShader(fshader);

    return viewProgram;
}

function initCalcProgram(vertShader, fragShader) {

    // Setup calcProgram for transform feedback
    function createShader(gl, source, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    var vshader = createShader(gl, getShaderSource(vertShader), gl.VERTEX_SHADER);
    var fshader = createShader(gl, getShaderSource(fragShader), gl.FRAGMENT_SHADER);

    var calcProgram = gl.createProgram();
    gl.attachShader(calcProgram, vshader);
    gl.attachShader(calcProgram, fshader);

    var varyings = ['v_position', 'v_velocity', 'v_spawntime'];
    gl.transformFeedbackVaryings(calcProgram, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(calcProgram);

    // check
    var log = gl.getProgramInfoLog(calcProgram);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(vshader);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(fshader);
    if (log) {
        console.log(log);
    }

    gl.deleteShader(vshader);
    gl.deleteShader(fshader);

    return calcProgram;
}

gl.useProgram(calcProgram);
gl.uniform4f(drawColorLocation, 0.0, 1.0, 1.0, 1.0);

function createTexture(gl) {
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // level
    gl.RGBA, // internalFormat,
    canvas.width, // targetTextureWidth,
    canvas.height, // targetTextureHeight
    0, // border,
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    null, // data
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // attach the texture as the first color attachment
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0, // attachmentPoint. Shader outputs here by linking 'out' variables
    gl.TEXTURE_2D,
    targetTexture,
    0, // mipmap level
  );

  return targetTexture
}

// Create framebuffer1
const fb1 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
const targetTexture1 = createTexture(gl)

// Create framebuffer2
const fb2 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
const targetTexture2 = createTexture(gl)

// Set the viewport
gl.viewport(0, 0, canvas.width, canvas.height);

// Set the clear color
gl.clearColor(0.0, 0.0, 0.0, 1.0);

function render() {

  // RUN CALCULATIONS
  {
    var time = Date.now() - appStartTime;
    var destinationIdx = (currentSourceIdx + 1) % 2;

    // render to targetTexture1 in framebuffer1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
    // gl.bindTexture(gl.TEXTURE_2D, targetTexture1);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Clear color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Toggle source and destination VBO
    var sourceVAO = particleVAOs[currentSourceIdx];
    var destinationTransformFeedback = particleTransformFeedbacks[destinationIdx];

    gl.bindVertexArray(sourceVAO);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, destinationTransformFeedback);

    // NOTE: The following four lines shouldn't be necessary, but are required to work in ANGLE
    // due to a bug in its handling of transform feedback objects.
    // https://bugs.chromium.org/p/angleproject/issues/detail?id=2051
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particleVBOs[destinationIdx][POSITION_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, particleVBOs[destinationIdx][VELOCITY_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, particleVBOs[destinationIdx][SPAWNTIME_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, particleVBOs[destinationIdx][LIFETIME_LOCATION]);

    // Set uniforms
    gl.uniform1f(drawTimeLocation, time);

    // Draw particles using transform feedback
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, NUM_PARTICLES);
    gl.endTransformFeedback();
  }

  // VIEW RESULT
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb1);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.blitFramebuffer(
    0, 0, canvas.width, canvas.height, // src bounds
    0, 0, canvas.width, canvas.height, // dest bounds
    gl.COLOR_BUFFER_BIT,
    gl.LINEAR,
  )

  /*
  {
    // set sourceVAO to the last clculation destination
    var sourceVAO = particleVAOs[currentSourceIdx + 1 % 2];
    gl.bindVertexArray(sourceVAO);
    // NOTE: The following line shouldn't be necessary, but are required to work in ANGLE
    // due to a bug in its handling of transform feedback objects.
    // https://bugs.chromium.org/p/angleproject/issues/detail?id=2051
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particleVBOs[destinationIdx][POSITION_LOCATION]);

    // draw to canvas, not a framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // read from targetTexture1
    gl.bindTexture(gl.TEXTURE_2D, targetTexture1);

    gl.drawArrays(gl.POINTS, 0, NUM_PARTICLES);
  }
  */

  // Ping pong the buffers
  currentSourceIdx = (currentSourceIdx + 1) % 2;


  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// If you have a long-running page, and need to delete WebGL resources, use:
//
// gl.deleteProgram(calcProgram);
// for (var i = 0; i < particleVAOs.length; ++i) {
//     gl.deleteVertexArray(particleVAOs[i]); 
//     gl.deleteTransformFeedback(particleTransformFeedbacks[i]);
//     for (var j = 0; j < NUM_LOCATIONS; ++j) {
//         gl.deleteBuffer(particleVBOs[i][j]);
//     }
// }
