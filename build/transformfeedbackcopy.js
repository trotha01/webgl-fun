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
    throw 'WebGL 2 context lost'
}, false);

// -- Declare variables for the particle system

// var NUM_PARTICLES = 1000000;
var NUM_PARTICLES = 100;
var ACCELERATION = 0;

var appStartTime = Date.now();
var currentSourceIdx = 0;

var calcProgram = initCalcProgram('vs-calc', 'fs-calc');

// Get uniform locations for the calc program
var drawTimeLocation = gl.getUniformLocation(calcProgram, 'u_time');
var atomTextureLocation = gl.getUniformLocation(calcProgram, "atomTexture");

// -- Initialize particle data

var particlePositions = new Float32Array(NUM_PARTICLES * 2);
var particleVelocities = new Float32Array(NUM_PARTICLES * 2);
var particleSpawntime = new Float32Array(NUM_PARTICLES);
var particleIDs = new Float32Array(NUM_PARTICLES);

var POSITION_LOCATION = 0;
var VELOCITY_LOCATION = 1;
var SPAWNTIME_LOCATION = 2;
var ID_LOCATION = 3;
var NUM_LOCATIONS = 4;

for (var p = 0; p < NUM_PARTICLES; ++p) {
    particlePositions[p * 2] = 0.0; // x position
    particlePositions[p * 2 + 1] = 0.0; // y position
    particleVelocities[p * 2] = 0.0; // x velocity
    particleVelocities[p * 2 + 1] = 0.0; // y velocity
    particleSpawntime[p] = 0.0;
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
    var err = false;
    if (log) {
        console.log(log);
        err = true;
    }

    log = gl.getShaderInfoLog(vshader);
    if (log) {
        console.log(log);
        err = true;
    }

    log = gl.getShaderInfoLog(fshader);
    if (log) {
        console.log(log);
        err = true;
    }

    gl.deleteShader(vshader);
    gl.deleteShader(fshader);
    if (err) {
      throw "error creating program"
    }

    return calcProgram;
}

gl.useProgram(calcProgram);

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

  // Attach the texture to the frame buffer so we can write to it.
  // We attach it as the first color attachment, it will be written to by default when using the current framebuffer.
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0, // attachmentPoint. Shader outputs here by linking 'out' variables
    gl.TEXTURE_2D,
    targetTexture,
    0, // mipmap level
  );

  return targetTexture
}

function hydrogenTexture(gl) {
  // pixel size 64
  const icon = document.getElementById('icon');
  console.log(icon);

  gl.activeTexture(gl.TEXTURE0 + 1);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, icon);
  // gl.generateMipmap(gl.TEXTURE_2D);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const red = [255,0,0,255]
  const green = [0,255,0,255]
  const blue = [0,0,255,255]
  const black = [255,255,255,255]
  const transparent = [0,0,0,0]

  const outerRow = [...red, ...red,   ...red,   ...red]
  const innerRow = [...blue, ...transparent,  ...transparent, ...transparent, ...transparent, ...transparent, ...transparent, ...blue]

  const width = 8
  const blueRow = Array(width).fill([...blue]).flat();
  console.log(blueRow);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // level
    gl.RGBA, // internalFormat,
    8, // textureWidth,
    8, // textureHeight
    /*
    1, // textureWidth
    1, // textureHeight
    */
    0, // border,
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    // new Uint8Array([...blue]) // data
    new Uint8Array([ // data
        ...blueRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...blueRow,
    ]),
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // possibly switch to GL_NEAREST for speed gains.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // possibly switch to GL_NEAREST for speed gains.
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // possibly switch to GL_NEAREST for speed gains.
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // possibly switch to GL_NEAREST for speed gains.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /*
  // attach the texture as the second color attachment
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT1, // attachmentPoint
    gl.TEXTURE_2D,
    texture,
    0, // mipmap level
  );
  */

  // atomTextureLocation = gl.getUniformLocation(calcProgram, "atomTexture");
  // gl.uniform1i(atomTextureLocation, 0);

  return texture
}

// Create framebuffer1
const fb1 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
const targetTexture1 = createTexture(gl)
hydrogenTexture(gl)

// Create framebuffer2
const fb2 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
const targetTexture2 = createTexture(gl)
hydrogenTexture(gl)

gl.activeTexture(gl.TEXTURE0);

// Set the viewport
gl.viewport(0, 0, canvas.width, canvas.height);

// Set the clear color
gl.clearColor(0.0, 0.0, 0.0, 1.0); // black
// gl.clearColor(1.0, 1.0, 1.0, 1.0); // white

/* Print framebuffer to screen */
function viewFramebuffer(fb) {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.blitFramebuffer(
    0, 0, canvas.width, canvas.height, // src bounds
    0, 0, canvas.width, canvas.height, // dest bounds
    gl.COLOR_BUFFER_BIT,
    gl.LINEAR,
  )
}

// These alternate, so when we are reading from fb1 (which has targetTexture1),
// we are writing to targetTexture2
// Then we read from fb2 (which has targetTexture2)
// and write to targetTexture1
const framebuffers = [fb1, fb2]
const textures = [targetTexture2, targetTexture1]

function render() {

  // RUN CALCULATIONS
  {
    var time = Date.now() - appStartTime;
    var destinationIdx = (currentSourceIdx + 1) % 2;

    // write to this framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[destinationIdx]);
    // read from this texture
    gl.bindTexture(gl.TEXTURE_2D, textures[destinationIdx]);

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

    // Set uniforms
    gl.uniform1f(drawTimeLocation, time);
    gl.uniform1i(atomTextureLocation, 1);

    // Draw particles using transform feedback
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, NUM_PARTICLES);
    gl.endTransformFeedback();
  }

  // VIEW RESULT
  viewFramebuffer(framebuffers[destinationIdx]);

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
