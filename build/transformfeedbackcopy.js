'use strict';

var pause = false
// toggle pause on spacebar
document.body.onkeyup = function(e){
    if(e.keyCode == 32){
      pause = !pause;
      console.log('pause', pause);
    }
}

// Setup Debugging Utils
function validateNoneOfTheArgsAreUndefined(functionName, args) {
  for (var ii = 0; ii < args.length; ++ii) {
    if (args[ii] === undefined) {
      console.error("undefined passed to gl." + functionName + "(" +
        WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");
    }
  }
} 

function throwOnGLError(err, funcName, args) {
  throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
};

function logGLCall(functionName, args) {
  /*
   const arg6 = args[6];
   if (functionName === 'gl.readPixels') {
     args[6] = "[buffer]"; // don't print entire array
     return;
   }
   */
   console.log("gl." + functionName + "(" +
      WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");
   // args[6] = arg6;
}

function logAndValidate(functionName, args) {
   // logGLCall(functionName, args);
   validateNoneOfTheArgsAreUndefined(functionName, args);
}

// -- Init Canvas
const canvas = document.getElementById('transform-feedback');

// -- Init WebGL Context
const canvasGl = canvas.getContext('webgl2', { antialias: false });
const gl = WebGLDebugUtils.makeDebugContext(canvasGl, throwOnGLError, logAndValidate);
const isWebGL2 = !!gl;
if(!isWebGL2)
{
    throw 'WebGL 2 is not available'
}

gl.imageSmoothingEnabled = false;

canvas.addEventListener("webglcontextlost", function(event) {
    event.preventDefault();
    throw 'WebGL 2 context lost'
}, false);

console.log('point size range:', gl.ALIASED_POINT_SIZE_RANGE)
console.log('point size granularity:', gl.ALIASED_POINT_SIZE_GRANULARITY)
console.log('point size granularity:', gl.POINT_SIZE_GRANULARITY)

// -- Declare variables for the particle system

// var NUM_PARTICLES = 1000000;
var NUM_PARTICLES = 2;
var ACCELERATION = 0;

var appStartTime = Date.now();
var currentSourceIdx = 0;

var calcProgram = initCalcProgram('vs-calc', 'fs-calc');

// Get uniform locations for the calc program
var drawTimeLocation = gl.getUniformLocation(calcProgram, 'u_time');
var deltaLocation = gl.getUniformLocation(calcProgram, 'u_delta');
var atomTextureLocation = gl.getUniformLocation(calcProgram, "atomTexture");
var pictureLocation = gl.getUniformLocation(calcProgram, "picture");

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

// console.log(particlePositions);
particlePositions = new Float32Array([0.5, 0.01, -0.5, 0.0])
particleVelocities = new Float32Array([1.0, 0.0, 1.0, 0.0])

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

function createFramebufferTexture(gl) {
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
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.CLAMP_TO_EDGE);
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

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + 1);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, icon);
  // gl.generateMipmap(gl.TEXTURE_2D);

  gl.enable(gl.BLEND);
  // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.blendEquation(gl.FUNC_ADD);

  const red = [255,0,0,255]
  const green = [0,255,0,255]
  const blue = [0,0,255,127]
  const white = [255,255,255,255]
  const black = [0,0,0,255]
  const transparent = [0,0,0,0]

  const outerRow = [...red, ...red,   ...red,   ...red]
  const innerRow = [...black, ...transparent,  ...transparent, ...transparent, ...transparent, ...transparent, ...transparent, ...black]

  const width = 8
  const blueRow = Array(width).fill([...blue]).flat();
  const blackRow = Array(width).fill([...black]).flat();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // level
    gl.RGBA32F, // internalFormat, also tried gl.RGBA
    8, // textureWidth
    8, // textureHeight
    0, // border,
    gl.RGBA, // format
    gl.FLOAT, // type, also tried gl.UNSIGNED_BYTE
    new Float32Array([ // data, also tried Uint8Array
        ...blackRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...innerRow,
        ...blackRow,
    ]),
  );

  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // possibly switch to GL_NEAREST for speed gains.
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // possibly switch to GL_NEAREST for speed gains.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
const targetTexture1 = createFramebufferTexture(gl)
const hydrogen = hydrogenTexture(gl)

// Create framebuffer2
const fb2 = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
const targetTexture2 = createFramebufferTexture(gl)
hydrogenTexture(gl)

// Attach textures to framebuffers,
// not quite sure if this is right
/*
gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
gl.activeTexture(gl.TEXTURE0 + 3);
gl.bindTexture(gl.TEXTURE_2D, targetTexture1);

gl.activeTexture(gl.TEXTURE0 + 2);
gl.bindTexture(gl.TEXTURE_2D, targetTexture2);

gl.activeTexture(gl.TEXTURE0);

gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
gl.activeTexture(gl.TEXTURE0 + 3);
gl.bindTexture(gl.TEXTURE_2D, targetTexture1);

gl.activeTexture(gl.TEXTURE0 + 2);
gl.bindTexture(gl.TEXTURE_2D, targetTexture2);
*/

gl.activeTexture(gl.TEXTURE0);

// Set the viewport
gl.viewport(0, 0, canvas.width, canvas.height);

// Set the clear color
gl.clearColor(0.0, 0.0, 0.0, 0.0); // transparent
// gl.clearColor(0.5, 0.5, 0.5, 1.0); // gray, velocity 0
// gl.clearColor(1.0, 1.0, 1.0, 1.0); // white


/* Print framebuffer to screen and grab pixel info*/
var pixels = new Uint8Array(canvas.width * canvas.height * 4);
function viewFramebuffer(fb) {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.blitFramebuffer(
    0, 0, canvas.width, canvas.height, // src bounds
    0, 0, canvas.width, canvas.height, // dest bounds
    gl.COLOR_BUFFER_BIT,
    gl.LINEAR,
  )

  // Below is for writting the raw data for debugging
  gl.readPixels(0, 0, canvas.width, canvas.height,
    gl.RGBA, // internalFormat,
    gl.UNSIGNED_BYTE, // type
    // gl.FLOAT, // type
    pixels);
  /*
  const dataWrapper = document.getElementById('pixel-data');
  // remove all previous data
  while (dataWrapper.firstChild) {
    dataWrapper.removeChild(dataWrapper.firstChild);
  }

  // add new data
  for (var i = 0; i < canvas.height; i++) {
    var row = document.createElement("div");
    for (var j = 0; j < canvas.width*4; j+=4) {
      var column = document.createElement("span");
      var r = pixels[i * canvas.width * 4 + j + 0]
      var g = pixels[i * canvas.width * 4 + j + 1]
      var b = pixels[i * canvas.width * 4 + j + 2]
      var a = pixels[i * canvas.width * 4 + j + 3]
      var pixelData = document.createTextNode(
        '[' + r + ' ' + g + ' ' + b + ' ' + a + '] '
      );
      column.appendChild(pixelData);
      column.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
      row.appendChild(column);
    }
    dataWrapper.appendChild(row);
  }
  // console.log(pixels);
  */
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function displayPixelInfo(e) {
  const x=e.clientX;
  const y=e.clientY;

  const pixelDataDiv = document.getElementById('pixel-info');
  // remove all previous data
  while (pixelDataDiv.firstChild) {
    pixelDataDiv.removeChild(pixelDataDiv.firstChild);
  }

  // add new data
  for(var i = y - 5; i < y + 6; i++) {
    var row = document.createElement("div");
    for(var j = x - 5; j < x + 6; j++) {
      var column = document.createElement("span");
      var r = pixels[i * canvas.width * 4 + j*4 + 0]
      var g = pixels[i * canvas.width * 4 + j*4 + 1]
      var b = pixels[i * canvas.width * 4 + j*4 + 2]
      var a = pixels[i * canvas.width * 4 + j*4 + 3]
      var pixelData = document.createTextNode(
	'[' + pad(r, 3, '-') + ' ' + pad(g, 3, '-') + ' ' + pad(b, 3, '-') + ' ' + pad(a, 3, '-') + '] '
      );
      column.appendChild(pixelData);
      column.style.backgroundColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      column.style.fontFamily = 'monospace';
      // console.log('rgba(' + r + ',' + g + ',' + b + ',' + a + ')');
      if (r < 10) { // make font white if background is dark
	column.style.color = 'white';
      }
      if (a === 0) {
	column.style.color = 'black';
      }

      row.appendChild(column);
    }
    pixelDataDiv.appendChild(row);
  }
}

// These alternate, so when we are reading from fb1 (which has targetTexture1),
// we are writing to targetTexture2
// Then we read from fb2 (which has targetTexture2)
// and write to targetTexture1
const framebuffers = [fb1, fb2]
const textures = [targetTexture2, targetTexture1]

var lastTimestamp = performance.now();
var delta = 0.01;
function render(timestamp) {
  if (pause) {
    requestAnimationFrame(render);
    return;
  }
  delta = Math.min((timestamp - lastTimestamp) / 1000, 0.01);
  lastTimestamp = timestamp;
  console.log('delta', delta);

  // gl.blendEquation(gl.FUNC_ADD);

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
    gl.uniform1f(deltaLocation, delta);
    gl.uniform1i(atomTextureLocation, 1);
    // gl.uniform1i(pictureLocation, destinationIdx + 2);
    gl.uniform1i(pictureLocation, 0);

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

// step forward and backward
document.body.onkeydown = function(e){
    // left arrow
    // step backwards
    if(e.keyCode == 37){
      console.log('step backward', pause);
      lastTimestamp = 0;
      pause = !pause;
      render(-10);
      pause = !pause;
    }

    // right arrow
    // step forward
    if(e.keyCode == 39){
      console.log('step forward', pause);
      lastTimestamp = 0;
      pause = !pause;
      render(10);
      pause = !pause;
    }
}
