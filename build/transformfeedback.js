'use strict';

// -- Init Canvas
const canvas = document.getElementById('transform-feedback');
// canvas.width = Math.min(window.innerWidth, window.innerHeight);
// canvas.height = canvas.width;
// document.body.appendChild(canvas);

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

var NUM_PARTICLES = 1000;
var ACCELERATION = -1.0;

var appStartTime = Date.now();
var currentSourceIdx = 0;

var program = initProgram();

// Get uniform locations for the draw program
var drawTimeLocation = gl.getUniformLocation(program, 'u_time');
var drawAccelerationLocation = gl.getUniformLocation(program, 'u_acceleration');
var drawColorLocation = gl.getUniformLocation(program, 'u_color');

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
    particlePositions[p * 2] = 0.0;
    particlePositions[p * 2 + 1] = 0.0;
    particleVelocities[p * 2] = 0.0;
    particleVelocities[p * 2 + 1] = 0.0;
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

function initProgram() {

    // Setup program for transform feedback
    function createShader(gl, source, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    var vshader = createShader(gl, getShaderSource('vs-draw'), gl.VERTEX_SHADER);
    var fshader = createShader(gl, getShaderSource('fs-draw'), gl.FRAGMENT_SHADER);

    var program = gl.createProgram();
    gl.attachShader(program, vshader);
    gl.attachShader(program, fshader);

    var varyings = ['v_position', 'v_velocity', 'v_spawntime', 'v_lifetime'];
    gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(program);

    // check
    var log = gl.getProgramInfoLog(program);
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

    return program;
}

gl.useProgram(program);
gl.uniform4f(drawColorLocation, 0.0, 1.0, 1.0, 1.0);
gl.uniform2f(drawAccelerationLocation, 0.0, ACCELERATION);

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

function render() {

    var time = Date.now() - appStartTime;
    var destinationIdx = (currentSourceIdx + 1) % 2;

    // Set the viewport
    gl.viewport(0, 0, canvas.width, canvas.height - 10);

    // Clear color buffer
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
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

    // Ping pong the buffers
    currentSourceIdx = (currentSourceIdx + 1) % 2;

    requestAnimationFrame(render);
}

requestAnimationFrame(render);

// If you have a long-running page, and need to delete WebGL resources, use:
//
// gl.deleteProgram(program);
// for (var i = 0; i < particleVAOs.length; ++i) {
//     gl.deleteVertexArray(particleVAOs[i]); 
//     gl.deleteTransformFeedback(particleTransformFeedbacks[i]);
//     for (var j = 0; j < NUM_LOCATIONS; ++j) {
//         gl.deleteBuffer(particleVBOs[i][j]);
//     }
// }
