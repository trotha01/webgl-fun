'use strict';

const vertexShader = `
        precision mediump float;

        // uniform float coolestTemp;
        // uniform float tempRange;
        uniform float deltaTime;

        attribute vec2 position;
        attribute vec2 velocity;

        // varying float temperature;

        void main () {
            // temperature = (position.x + 1.0) / tempRange;
            gl_Position = vec4(position + (velocity * deltaTime), 0, 1.0);
            // gl_Position = vec4(position, 0.0, 1.0);
            gl_PointSize = 20.0;
        }
`;

const fragmentShader = `
        precision mediump float;

        // uniform vec3 coolestColor;
        // uniform vec3 hottestColor;

        // varying float temperature;

        void main () {
            // vec3 color = mix(coolestColor, hottestColor, temperature);
            // gl_FragColor = vec4(color, 1.0);
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
`;

// Get WebGL Context
const gl = getWebGLContext("game-canvas")

// Setup Vertex Buffers
const positions = [
   0.0,  0.0,
   0.3,  0.3,
   0.5,  0.5,
   0.7,  0.7,
   1.0,  1.0,
];
const vertexCount = 5;

const velocities = [
   0.1,  0.1,
   0.0,  0.1,
   0.1,  0.0,
   0.0,  0.0,
   0.0,  0.0,
];

const buffers = initBuffers(gl, positions, velocities);
// const buffers = initBuffers(gl, positions);

// Create Program
const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader);

const programInfo = {
  program: shaderProgram,
  attribLocations: {
    position: gl.getAttribLocation(shaderProgram, 'position'),
    velocity: gl.getAttribLocation(shaderProgram, 'velocity'),
  },
  uniformLocations: {
    deltaTime: gl.getUniformLocation(shaderProgram, 'deltaTime'),
    /*
    coolestTemp : gl.getUniformLocation(shaderProgram, 'coolestTemp'),
    tempRange : gl.getUniformLocation(shaderProgram, 'tempRange'),
    coolestColor : gl.getUniformLocation(shaderProgram, 'coolestColor'),
    hottestColor : gl.getUniformLocation(shaderProgram, 'hottestColor'),
    */
  },
};

// drawScene(gl, programInfo, buffers, vertexCount);

var then = 0;
var totalTime = 0;

// Draw the scene repeatedly
function render(now) {
  now *= 0.001;  // convert to seconds
  const deltaTime = now - then;
  totalTime += deltaTime
  then = now;

  drawScene(gl, programInfo, buffers, vertexCount, totalTime);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
