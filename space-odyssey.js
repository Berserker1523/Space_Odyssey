// WebGL2
("use strict");
const btn = document.getElementById("pause");
btn.onclick = pause;
const btnPause = document.getElementById("pauseButton");
btnPause.onclick = pause;
const puntaje = document.getElementById("puntaje");
const pausePanel = document.getElementById("panel");
pausePanel.hidden = false;
const endPanel = document.getElementById("end");
endPanel.hidden = true;

//------------------------- Shaders ----------------------------------------------

//Shaders for draw colliders ---------------------------------------------
let vertexShaderCol = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;

// A matrix to transform the positions by
uniform mat3 u_matrix;

// all shaders have a main function
void main() {
  // Multiply the position by the matrix.
  gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
}
`;

let fragmentShaderCol = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  // Just set the output to a constant green
  outColor = vec4(0, 1, 0, 1);;
}
`;
//Shaders for draw textured entitys ---------------------------------------------
let vertexShaderTex = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;
in vec2 a_texcoord;

// A matrix to transform the positions by
uniform mat3 u_matrix;

// a letying to pass the texture coordinates to the fragment shader
out vec2 v_texcoord;

// all shaders have a main function
void main() {
  // Multiply the position by the matrix.
  gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);

  // Pass the texcoord to the fragment shader.
  v_texcoord = a_texcoord;
}
`;

let fragmentShaderTex = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;

// Passed in from the vertex shader.
in vec2 v_texcoord;

// The texture.
uniform sampler2D u_texture;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texcoord);
}
`;

// --------------------------- Globals ---------------------------------
//MAYUS = constant
// $ means global
let $DEBUG = false;
const $SHOW_COLLIDERS = $DEBUG;

//can shoot each x seconds
const $BULLET_SPAM_TIME_MAX = 0.5;
let $bullet_spam = 0;

//spam each range
const $FOE_SPAM_TIME_MIN_INIT = 2;
let $foe_spam_time_min = $FOE_SPAM_TIME_MIN_INIT;
const $FOE_SPAM_TIME_MAX = 5;
let $foe_spam = 0;

//for object recognition
let $current_obj_id = 0;

//Velocity of entitys
const $VEL_ASTEROID = -200;
const $VEL_SPACE = -200;

let $vel_space_ship = [200, 200];
let $vel_bullet = [300, 0];
let $vel_asteroid = [$VEL_ASTEROID, 0];
let $vel_space = [$VEL_SPACE, 0];

//For bg movement
let $must_create_right_bg = false;

//For increasing the speed
let $level = 0;

let $pause = true;
let $perdio = false;

// --------------------- Audios -------------------------------------------------------------------
let $bullet_audio = new Audio(
  "https://freesound.org/data/previews/466/466834_8430571-lq.mp3"
);
let $asteroid_explosion_audio = new Audio(
  "https://freesound.org/data/previews/245/245372_3545904-lq.mp3"
);
let $space_ship_explosion = new Audio(
  "https://freesound.org/data/previews/235/235968_4265427-lq.mp3"
);

// -------------------- Base entity ---------------------------------------------------
const entity = function(
  gl,
  programInfo,
  positions,
  movement_function,
  collider,
  can_disappear,
  life_time,
  primitive,
  texture_unit,
  object_type,
  colliderProgramInfo
) {
  //Create a vertex array object (attribute state)
  this.vao = gl.createVertexArray();
  //Make this vao the one we're currently working with
  gl.bindVertexArray(this.vao);

  //------------------------ Vertex Position Attribute ------------------------------------------

  // Create a buffer and put three 2d clip space points in it
  this.vertex_position_buffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertex_position_buffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_position_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Turn on the attribute in the vertex array object
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  let size = 2; // 2 components per iteration
  let type = gl.FLOAT; // the data is 32bit floats
  let normalize = false; // don't normalize the data
  let stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  let offset = 0; // start at the beginning of the buffer

  //Tells gl how to get the attribute from the buffer
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    size,
    type,
    normalize,
    stride,
    offset
  );

  //------------------------ Texture Position Attribute ------------------------------------------

  this.texture_positions = [0, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0];

  // Create a buffer for texture coordinates
  this.texture_position_buffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = texture_position_buffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, this.texture_position_buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Uint8Array(this.texture_positions),
    gl.STATIC_DRAW
  );

  // Turn on the attribute
  gl.enableVertexAttribArray(programInfo.attribLocations.texturePosition);

  // Tell the attribute how to get data out of texture_position_buffer (ARRAY_BUFFER)
  size = 2; // 2 components per iteration
  type = gl.UNSIGNED_BYTE; // the data is 8bit unsigned integers
  normalize = true; // convert from 0-255 to 0.0-1.0
  stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(
    programInfo.attribLocations.texturePosition,
    size,
    type,
    normalize,
    stride,
    offset
  );

  //------------------------ Collider ------------------------------------------
  if ($SHOW_COLLIDERS && collider && colliderProgramInfo) {
    //Create a vertex array object (attribute state)
    this.collider_vao = gl.createVertexArray();
    //Make this vao the one we're currently working with
    gl.bindVertexArray(this.collider_vao);

    //------------------------ Vertex Position Attribute ------------------------------------------

    // Create a buffer and put three 2d clip space points in it
    this.collider_vertex_position_buffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertex_position_buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.collider_vertex_position_buffer);
    this.collider_positions = [
      collider.x,
      collider.y,
      collider.x,
      collider.y + collider.height,
      collider.x + collider.width,
      collider.y + collider.height,
      collider.x + collider.width,
      collider.y
    ];
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.collider_positions),
      gl.STATIC_DRAW
    );

    // Turn on the attribute
    gl.enableVertexAttribArray(
      colliderProgramInfo.attribLocations.vertexPosition
    );

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    size = 2; // 2 components per iteration
    type = gl.FLOAT; // the data is 32bit floats
    normalize = false; // don't normalize the data
    stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    offset = 0; // start at the beginning of the buffer

    gl.vertexAttribPointer(
      colliderProgramInfo.attribLocations.vertexPosition,
      size,
      type,
      normalize,
      stride,
      offset
    );

    //------------------------ Indices ------------------------------------------
    this.collider_index_buffer = gl.createBuffer();

    // make this buffer the current 'ELEMENT_ARRAY_BUFFER'
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.collider_index_buffer);

    // Fill the current element array buffer with data
    this.collider_indices = [
      0,
      1, // first line
      1,
      2, // second line
      2,
      3,
      0,
      3
    ];

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(this.collider_indices),
      gl.STATIC_DRAW
    );
  }

  {
    this.id = $current_obj_id++;
    this.matrix = mat3.create();
    this.positions = positions;
    this.movement_function = movement_function;
    this.collider = collider;
    this.can_disappear = can_disappear;
    this.life_time = life_time;
    this.vertices_count = positions.length / size;
    this.primitive = primitive;
    this.texture_unit = texture_unit;
    this.object_type = object_type;
    if (object_type === "explosion") {
      this.animation_time = 0;
    }
    /*
    this.vao
    this.vertex_position_buffer
    this.texture_positions
    this.texture_position_buffer
    this.collider_vao
    this.collider_positions
    this.collider_vertex_position_buffer
    */
  }
};

//read only
let $entitys_to_draw = [];
//for avoid bugs when adding or remove entitys, it will be the draw array in next frame
let $entitys_to_draw_copy = [];

//-------------Keyboard Management---------------------------------------
// Get input of arrow keys and x
const $KEYBOARD_HELPER = { left: 37, up: 38, right: 39, down: 40, x: 88 };
const $KEYS_PRESSED = {
  left: false,
  up: false,
  right: false,
  down: false,
  x: false
};
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

//Main returns render method for call it from different places, e.g. after all textures where loaded
let $render = main();
let $proc_id = null;

//If debug, allow play without textures
if ($DEBUG) $proc_id = requestAnimationFrame($render);

function new_game(){
  $entitys_to_draw = [];
  $entitys_to_draw_copy = [];
  $pause = true;
  $perdio = false;
  $level = 0;
  $must_create_right_bg = false;
  $vel_space_ship = [200, 200];
  $vel_bullet = [300, 0];
  $vel_asteroid = [$VEL_ASTEROID, 0];
  $vel_space = [$VEL_SPACE, 0];
  $current_obj_id = 0;
  $foe_spam_time_min = $FOE_SPAM_TIME_MIN_INIT;
  $foe_spam = 0;
  $bullet_spam = 0;
  cancelAnimationFrame($proc_id);

  $render = main();
  console.log("asdasdasda");
  $proc_id = requestAnimationFrame($render);
}

function main() {
  // Get A WebGL context
  let canvas = document.getElementById("canvas");
  let gl = canvas.getContext("webgl2");
  if (!gl) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }

  // create GLSL shaders, upload the GLSL source, compile the shaders
  let vertexShaderCollider = createShader(
    gl,
    gl.VERTEX_SHADER,
    vertexShaderCol
  );
  let fragmentShaderCollider = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderCol
  );
  // Link the two shaders into a program
  let shaderProgramCollider = createProgram(
    gl,
    vertexShaderCollider,
    fragmentShaderCollider
  );

  // Collect all the info needed to use the shader program.
  // Look up which attributes or uniforms our shader program is using
  const programColliderInfo = {
    program: shaderProgramCollider,
    // look up where the vertex data needs to go.
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgramCollider, "a_position")
    },
    uniformLocations: {
      Matrix: gl.getUniformLocation(shaderProgramCollider, "u_matrix")
    }
  };

  let vertexShaderTexture = createShader(gl, gl.VERTEX_SHADER, vertexShaderTex);
  let fragmentShaderTexture = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderTex
  );
  let shaderProgramTexture = createProgram(
    gl,
    vertexShaderTexture,
    fragmentShaderTexture
  );

  const programTextureInfo = {
    program: shaderProgramTexture,
    // look up where the vertex data needs to go.
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgramTexture, "a_position"),
      texturePosition: gl.getAttribLocation(shaderProgramTexture, "a_texcoord")
    },
    uniformLocations: {
      Matrix: gl.getUniformLocation(shaderProgramTexture, "u_matrix"),
      Texture: gl.getUniformLocation(shaderProgramTexture, "u_texture")
    }
  };
  const textures_urls = [
    //asteroids
    "https://i.imgur.com/foqRoQQ.png",
    //bullets
    "https://i.imgur.com/mstghGe.png",
    //space_ship
    "https://i.imgur.com/XpLJpPG.png",

    //explosion_animation
    "https://i.imgur.com/4UYbxEK.png",
    "https://i.imgur.com/dZ3NlNy.png",
    "https://i.imgur.com/ermNEWm.png",
    "https://i.imgur.com/jQBtmM4.png",
    "https://i.imgur.com/QjhBtnD.png",
    "https://i.imgur.com/9baPnhh.png",
    "https://i.imgur.com/W2pqldM.png",
    "https://i.imgur.com/jpW0rrF.png",
    "https://i.imgur.com/6TvQgdE.png",
    "https://i.imgur.com/iu5PZWO.png",
    "https://i.imgur.com/daImnDI.png",
    "https://i.imgur.com/HQ2rA4S.png",
    "https://i.imgur.com/NKCEZdv.png",
    "https://i.imgur.com/N4ijuJk.png",
    "https://i.imgur.com/bkhlIb0.png",
    "https://i.imgur.com/O7oVyKL.png",
    "https://i.imgur.com/YiyDs4k.png",
    "https://i.imgur.com/X19e8nj.png",
    "https://i.imgur.com/BRwny0O.png",
    "https://i.imgur.com/eBtmaOs.png",
    "https://i.imgur.com/TMwDvdP.png",
    "https://i.imgur.com/8mUhBiZ.png",
    "https://i.imgur.com/m88F16b.png",

    //background
    "https://i.imgur.com/wJS09g4.png"
  ];
  //Load images an init texture units
  loadImages(gl, textures_urls);

  // Here is where we set initial entitys
  const background1 = create_background(gl, programTextureInfo);
  const background2 = create_background(gl, programTextureInfo);
  const space_ship = create_space_ship(
    gl,
    programTextureInfo,
    programColliderInfo
  );
  const bullet = create_bullet(
    gl,
    programTextureInfo,
    programColliderInfo,
    space_ship.matrix
  );
  const asteroid = create_asteroid(gl, programTextureInfo, programColliderInfo);

  let firstInserted = $entitys_to_draw_copy.push(background1);
  $entitys_to_draw_copy.push(background2);
  $entitys_to_draw_copy.push(space_ship);
  $entitys_to_draw_copy.push(bullet);
  $entitys_to_draw_copy.push(asteroid);

  if ($DEBUG) {
    console.log("main: create initials");
    console.log("textures.length: " + textures_urls.length);
    console.log("$entitys_to_draw.length at first insertion: " + firstInserted);
    console.log("$entitys_to_draw.length at init: ");
    console.log($entitys_to_draw_copy.slice());
  }

  let then = 0;
  //----------------------- MAIN Loop -----------------------------------------------
  const render = function(now) {
    console.log("jghjghgkjg");
    //Do nothing if game is paused
    if (!$pause && !$perdio) {
      console.log("nmvbxncmxc");
      // Convert the time to seconds
      now *= 0.001;

      // Subtract the previous time from the current time
      let deltaTime = now - then;

      //Recovery from pause
      if (deltaTime > 0.1) {
        deltaTime = 0.1;
      }
      // Remember the current time for the next frame.
      then = now;

      //Increment the level
      $level += deltaTime / 1;
      puntaje.innerHTML = "Tiempo: " + Math.floor( $level );
      //depending on level
      increase_velocity();

      //increment variables for enable new spam of these entitys
      $bullet_spam += deltaTime;
      $foe_spam += deltaTime;
      //spam if minimun time passes
      generate_random_asteroid(gl, programTextureInfo, programColliderInfo);

      //update objects with insertions and deletions
      $entitys_to_draw = $entitys_to_draw_copy.slice();

      //draw all entitys
      drawScene(gl, programTextureInfo, programColliderInfo, deltaTime);
    }
    $proc_id = requestAnimationFrame(render);
  };

  return render;
}

//change pause
function pause() {
  $pause = !$pause;
  pausePanel.hidden = !pausePanel.hidden;
}

function drawScene(gl, programTextureInfo, programColliderInfo, deltaTime) {
  const resized = resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  //enable transparency in png textures
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);

  $entitys_to_draw.forEach(element => {
    if (element.object_type === "background") {
      //There are 2 bgs, interchange them as they move or resize with canvas
      resize_background(gl, programTextureInfo, element, resized);
    }

    //if entity passes it life_time, then die
    let dead = manage_life_time(element, deltaTime);
    if (dead) return;

    //call entity movement function
    element.movement_function(gl, programTextureInfo, element, deltaTime);

    //Verify collisions with this entity
    if (element.collider) {
      let collision = manage_collisions(gl, programTextureInfo, element);
      if (collision) return;
    }

    //draw function
    draw_element(gl, programTextureInfo, programColliderInfo, element);
  });
}

function draw_element(gl, programInfo, colliderProgramInfo, element) {
  // Tell it to use our program (pair of shaders)
  gl.useProgram(programInfo.program);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(element.vao);

  //Set the uniform for texture unit
  gl.uniform1i(programInfo.uniformLocations.Texture, element.texture_unit);

  //Projection Matrix 2D
  let projection_matrix = mat3.create();
  mat3.projection(
    projection_matrix,
    gl.canvas.clientWidth,
    gl.canvas.clientHeight
  );
  mat3.multiply(projection_matrix, projection_matrix, element.matrix);

  gl.uniformMatrix3fv(
    programInfo.uniformLocations.Matrix,
    false,
    projection_matrix
  );

  // draw
  let primitiveType = element.primitive;
  let offset = 0;
  let count = element.vertices_count;
  gl.drawArrays(primitiveType, offset, count);

  //If show colliders then draw those
  if ($SHOW_COLLIDERS && element.collider)
    draw_collider(gl, colliderProgramInfo, element, projection_matrix);

  if ($DEBUG) {
    console.log("draw_element: ");
    console.log(element.matrix.slice());
    console.log(projection_matrix.slice());
    console.log(Object.assign({}, element));
    $DEBUG = false;
  }
}

function draw_collider(gl, programInfo, element, projection_matrix) {
  // Tell it to use our program (pair of shaders)
  gl.useProgram(programInfo.program);

  // Bind the attribute/buffer set we want.
  gl.bindVertexArray(element.collider_vao);

  gl.uniformMatrix3fv(
    programInfo.uniformLocations.Matrix,
    false,
    projection_matrix
  );

  // bind the buffer containing the indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element.collider_index_buffer);

  // draw
  let primitiveType = gl.LINES;
  let count = 8;
  let indexType = gl.UNSIGNED_SHORT;
  let offset = 0;
  gl.drawElements(primitiveType, count, indexType, offset);

  if ($DEBUG) {
    console.log("draw_collider: ");
    console.log(element.matrix.slice());
    console.log(projection_matrix.slice());
    console.log(Object.assign({}, element));
  }
}

function manage_life_time(entity, deltaTime) {
  if ($DEBUG) {
    console.log("manage_life_time: ");
    console.log(Object.assign({}, entity));
  }

  //if can disappear, kill it or reduce it life_time
  if (entity.can_disappear) {
    if (entity.life_time <= 0) {
      if ($DEBUG) {
        console.log("manage_life_time: entity.life_time > 0");
        console.log(entity.can_disappear);
        console.log(entity.life_time);
      }
      destroy_object(entity);
      return true;
    } else {
      if ($DEBUG) {
        console.log("manage_life_time: entity.life_time <= 0");
        console.log(entity.can_disappear);
        console.log(entity.life_time);
      }
      entity.life_time -= deltaTime;
      return false;
    }
  }

  return false;
}

function manage_collisions(gl, programInfo, entity) {
  if ($DEBUG) {
    console.log("manage_collisions: ");
    console.log(Object.assign({}, entity));
  }
  let collision = false;

  //Here I had a bug using "original" entity's array, so I use this
  $entitys_to_draw_copy.forEach(entity_to_compare => {
    //detect collisions only if not is the same entity, no bullet vs space_ship,
    //not is the same type of entity
    if (entity_to_compare.collider && entity_to_compare.id !== entity.id) {
      if (
        !(
          (entity.object_type === "space_ship" ||
            entity.object_type === "bullet") &&
          (entity_to_compare.object_type === "bullet" ||
            entity_to_compare.object_type === "space_ship")
        ) &&
        !(entity.object_type === entity_to_compare.object_type) &&
        detect_collision(entity, entity_to_compare)
      ) {
        collision = true;

        //only ship and asteroids creates explosions
        if (entity.object_type !== "bullet") {
          $entitys_to_draw_copy.push(
            create_explosion(gl, programInfo, entity.positions, entity.matrix)
          );
        }
        destroy_object(entity);

        if (entity_to_compare.object_type !== "bullet") {
          $entitys_to_draw_copy.push(
            create_explosion(
              gl,
              programInfo,
              entity_to_compare.positions,
              entity_to_compare.matrix
            )
          );
        }
        destroy_object(entity_to_compare);
      }
    }
  });

  return collision;
}

function increase_velocity() {
  //increase velocity according to the level
  $vel_asteroid[0] = $VEL_ASTEROID - $level;
  $vel_space[0] = $VEL_SPACE - $level;
  $foe_spam_time_min =
    $foe_spam_time_min > 0.2 ? -$level + $FOE_SPAM_TIME_MIN_INIT : 0.2;
  return $level;
}

function generate_random_asteroid(gl, programInfo, colliderProgramInfo) {
  //generates random asteroid after certain time
  if (
    $foe_spam >=
    Math.random() * ($FOE_SPAM_TIME_MAX - $foe_spam_time_min) +
      $foe_spam_time_min
  ) {
    $foe_spam = 0;
    $entitys_to_draw_copy.push(
      create_asteroid(gl, programInfo, colliderProgramInfo)
    );
  }
}

function resize_background(gl, programInfo, prev_bg, canvas_resized) {
  //resize bg entity
  if (canvas_resized) {
    destroy_object(prev_bg);
    $entitys_to_draw_copy.unshift(create_background(gl, programInfo));
    if ($DEBUG) console.log("bg resized by canvas resize");
  }
  //teletransport bgs for movement animation
  else if (prev_bg.matrix[6] <= -gl.canvas.clientWidth) {
    mat3.translate(prev_bg.matrix, prev_bg.matrix, [
      gl.canvas.clientWidth * 2,
      0
    ]);
    if ($DEBUG) console.log("bg translated");
  }
}

function destroy_object(element) {
  //find it object index and remove
  let element_index = $entitys_to_draw_copy.findIndex(
    object => object.id === element.id
  );
  $entitys_to_draw_copy.splice(element_index, 1);

  //plays audio if ship
  if (element.object_type === "space_ship") {
    setTimeout(()=>{
      $perdio=true;
      endPanel.hidden = false;
      document.getElementById("puntajeFin").innerHTML="Puntaje: " + Math.floor( $level );;
      setTimeout(() => {
        endPanel.hidden = true;
        pausePanel.hidden = false;
        new_game();
      }, 2000);
    }, 5000);
    $space_ship_explosion.play();
    $space_ship_explosion = new Audio(
      "https://freesound.org/data/previews/235/235968_4265427-lq.mp3"
    );
  }
}

function detect_collision(element1, element2) {
  if ($DEBUG) {
    console.log("detect_collision: ");
    console.log(Object.assign({}, element1));
    console.log(Object.assign({}, element2));
  }
  const collider1 = {
    x: element1.collider.x + element1.matrix[6],
    y: element1.collider.y + element1.matrix[7],
    height: element1.collider.height,
    width: element1.collider.width
  };

  const collider2 = {
    x: element2.collider.x + element2.matrix[6],
    y: element2.collider.y + element2.matrix[7],
    height: element2.collider.height,
    width: element2.collider.width
  };

  if ($DEBUG) {
    console.log(collider1);
    console.log(collider2);
  }

  //Obtained from: https://developer.mozilla.org/es/docs/Games/Techniques/2D_collision_detection
  if (
    collider1.x < collider2.x + collider2.width &&
    collider1.x + collider1.width > collider2.x &&
    collider1.y < collider2.y + collider2.height &&
    collider1.height + collider1.y > collider2.y
  ) {
    if ($DEBUG) {
      console.log("Colision!!!!");
      console.log(collider1);
      console.log(collider2);
    }
    return true;
  } else {
    return false;
  }
}

//------------------------------------ Functions for create entitys ------------------------

function create_space_ship(gl, programInfo, colliderProgramInfo) {
  const positions = [0, 0, 0, 80, 80, 80, 0, 0, 80, 80, 80, 0];

  const movement_function = function(gl, programInfo, entity, deltaTime) {
    let translation = [0, 0];

    //dont allow pass the screen
    if ($KEYS_PRESSED.left) {
      if (!(entity.collider.x + entity.matrix[6] <= 0)) {
        translation[0] -= $vel_space_ship[0] * deltaTime;
      }
    } else if ($KEYS_PRESSED.right) {
      if (
        !(
          entity.collider.x + entity.collider.width + entity.matrix[6] >=
          gl.canvas.clientWidth
        )
      ) {
        translation[0] += $vel_space_ship[0] * deltaTime;
      }
    }
    if ($KEYS_PRESSED.up) {
      if (!(entity.collider.y + entity.matrix[7] <= 0)) {
        translation[1] -= $vel_space_ship[1] * deltaTime;
      }
    } else if ($KEYS_PRESSED.down) {
      if (
        !(
          entity.collider.y + entity.collider.height + entity.matrix[7] >=
          gl.canvas.clientHeight
        )
      ) {
        translation[1] += $vel_space_ship[1] * deltaTime;
      }
    }

    //Apply the movement
    mat3.translate(entity.matrix, entity.matrix, translation);

    //Spam bullet
    if ($KEYS_PRESSED.x && $bullet_spam >= $BULLET_SPAM_TIME_MAX) {
      $bullet_spam = 0;
      $entitys_to_draw_copy.push(
        create_bullet(gl, programInfo, colliderProgramInfo, entity.matrix)
      );
      $bullet_audio.play();
      $bullet_audio = new Audio(
        "https://freesound.org/data/previews/466/466834_8430571-lq.mp3"
      );
    }

    if ($DEBUG) {
      console.log("movement_function_space_ship: ");
      console.log(Object.assign({}, entity));
      console.log(translation);
    }
  };

  const collider = { x: 0, y: 30, width: 80, height: 20 };

  const primitive = gl.TRIANGLES;

  const can_disappear = false;

  const life_time = 1;

  const texture_unit = 2;

  const object_type = "space_ship";

  return new entity(
    gl,
    programInfo,
    positions,
    movement_function,
    collider,
    can_disappear,
    life_time,
    primitive,
    texture_unit,
    object_type,
    colliderProgramInfo
  );
}

function create_bullet(
  gl,
  programInfo,
  colliderProgramInfo,
  space_ship_matrix
) {
  const positions = [0, 0, 0, 5, 40, 5, 0, 0, 40, 5, 40, 0];

  const movement_function = function(gl, programInfo, entity, deltaTime) {
    //Move to the right
    const translation = [0, 0];
    translation[0] += $vel_bullet[0] * deltaTime;
    mat3.translate(entity.matrix, entity.matrix, translation);
    if ($DEBUG) {
      console.log("movement_function_bullet: ");
      console.log(Object.assign({}, entity));
      console.log(translation);
    }
  };

  const collider = { x: 0, y: 0, width: 40, height: 5 };

  const primitive = gl.TRIANGLES;

  const can_disappear = true;

  const life_time = 2;

  const texture_unit = 1;

  const object_type = "bullet";

  const bullet = new entity(
    gl,
    programInfo,
    positions,
    movement_function,
    collider,
    can_disappear,
    life_time,
    primitive,
    texture_unit,
    object_type,
    colliderProgramInfo
  );
  mat3.multiply(bullet.matrix, space_ship_matrix, bullet.matrix);
  mat3.translate(bullet.matrix, bullet.matrix, [70, 37.5]);

  return bullet;
}

function create_asteroid(gl, programInfo, colliderProgramInfo) {
  const positions = [0, 0, 0, 75, 75, 75, 0, 0, 75, 75, 75, 0];

  const movement_function = function(gl, programInfo, entity, deltaTime) {
    //move to the left
    const translation = [0, 0];
    translation[0] += $vel_asteroid[0] * deltaTime;
    mat3.translate(entity.matrix, entity.matrix, translation);

    if ($DEBUG) {
      console.log("movement_function_asteroid: ");
      console.log(Object.assign({}, entity));
      console.log(translation);
    }
  };

  const collider = { x: 0, y: 10, width: 75, height: 60 };

  const primitive = gl.TRIANGLES;

  const can_disappear = true;

  const life_time = Math.abs((gl.canvas.clientWidth + 75) / $vel_asteroid[0]);

  const texture_unit = 0;

  const object_type = "asteroid";

  const asteroid = new entity(
    gl,
    programInfo,
    positions,
    movement_function,
    collider,
    can_disappear,
    life_time,
    primitive,
    texture_unit,
    object_type,
    colliderProgramInfo
  );

  let random_y = Math.random() * gl.canvas.clientHeight;
  if (random_y > gl.canvas.clientHeight - 75)
    random_y = gl.canvas.clientHeight - 75;
  mat3.translate(asteroid.matrix, asteroid.matrix, [
    gl.canvas.clientWidth,
    random_y
  ]);

  return asteroid;
}

function create_explosion(gl, programInfo, parent_positions, parent_matrix) {
  //Play audio on init
  $asteroid_explosion_audio.play();
  $asteroid_explosion_audio = new Audio(
    "https://freesound.org/data/previews/245/245372_3545904-lq.mp3"
  );

  const movement_function = function(gl, programInfo, entity, deltaTime) {
    //Animate texture change

    let animation_time_parts = (entity.animation_time + "").split(".");
    let integerPart = parseInt(animation_time_parts[0], 10);
    let decimalPart = animation_time_parts[1]
      ? parseInt(animation_time_parts[1][0], 10)
      : 0;

    entity.texture_unit = integerPart * 10 + decimalPart + 3;

    entity.animation_time += deltaTime;

    if ($DEBUG) {
      console.log("movement_function_space_ship: ");
      console.log(Object.assign({}, entity));
    }
  };

  const collider = null;

  const primitive = gl.TRIANGLES;

  const can_disappear = true;

  const life_time = 2.3;

  const texture_unit = 3;

  const object_type = "explosion";

  const explosion = new entity(
    gl,
    programInfo,
    parent_positions,
    movement_function,
    collider,
    can_disappear,
    life_time,
    primitive,
    texture_unit,
    object_type,
    null
  );

  mat3.multiply(explosion.matrix, parent_matrix, explosion.matrix);

  return explosion;
}

function create_background(gl, programInfo) {
  const positions = [
    0,
    0,
    0,
    gl.canvas.clientHeight,
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    0,
    0,
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    gl.canvas.clientWidth,
    0
  ];

  const movement_function = function(gl, programInfo, entity, deltaTime) {
    //Move to the left
    const translation = [0, 0];
    translation[0] += $vel_space[0] * deltaTime;
    mat3.translate(entity.matrix, entity.matrix, translation);
  };

  const collider = null;

  const primitive = gl.TRIANGLES;

  const can_disappear = false;

  const life_time = 1;

  const texture_unit = 26;

  const object_type = "background";

  const colliderProgramInfo = null;

  const bg = new entity(
    gl,
    programInfo,
    positions,
    movement_function,
    collider,
    can_disappear,
    life_time,
    primitive,
    texture_unit,
    object_type,
    colliderProgramInfo
  );

  if ($must_create_right_bg) {
    mat3.translate(bg.matrix, bg.matrix, [gl.canvas.clientWidth, 0]);
    $must_create_right_bg = false;
  } else {
    $must_create_right_bg = true;
  }
  return bg;
}

//--------------------------- Event Handlers ------------------------------------------
function keyDownHandler(event) {
  if (event.keyCode == $KEYBOARD_HELPER.right) {
    $KEYS_PRESSED.right = true;
  } else if (event.keyCode == $KEYBOARD_HELPER.left) {
    $KEYS_PRESSED.left = true;
  }
  if (event.keyCode == $KEYBOARD_HELPER.down) {
    $KEYS_PRESSED.down = true;
  } else if (event.keyCode == $KEYBOARD_HELPER.up) {
    $KEYS_PRESSED.up = true;
  }
  if (event.keyCode == $KEYBOARD_HELPER.x) {
    $KEYS_PRESSED.x = true;
  }
}

function keyUpHandler(event) {
  if (event.keyCode == $KEYBOARD_HELPER.right) {
    $KEYS_PRESSED.right = false;
  }
  if (event.keyCode == $KEYBOARD_HELPER.left) {
    $KEYS_PRESSED.left = false;
  }
  if (event.keyCode == $KEYBOARD_HELPER.down) {
    $KEYS_PRESSED.down = false;
  }
  if (event.keyCode == $KEYBOARD_HELPER.up) {
    $KEYS_PRESSED.up = false;
  }
  if (event.keyCode == $KEYBOARD_HELPER.x) {
    $KEYS_PRESSED.x = false;
  }
}

//---------------- Canvas and GL utilities-------------------------------------------------
function resizeCanvasToDisplaySize(canvas) {
  // Lookup the size the browser is displaying the canvas.
  let displayWidth = canvas.clientWidth;
  let displayHeight = canvas.clientHeight;

  // Check if the canvas is not the same size.
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return true;
  }
  return false;
}

function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader)); // eslint-disable-line
  gl.deleteShader(shader);
  return undefined;
}

function createProgram(gl, vertexShader, fragmentShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program)); // eslint-disable-line
  gl.deleteProgram(program);
  return undefined;
}

//------------------------ Texture Management -----------------------------------------------

function loadTexturesBlank(gl, urls) {
  let textures = urls.map((url, i) => {
    // Create a texture.
    let texture = gl.createTexture();

    // use texture unit i
    gl.activeTexture(gl.TEXTURE0 + i);

    // bind to the TEXTURE_2D bind point of texture unit i
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 255, 255])
    );

    return texture;
  });

  return textures;
}

function loadTextures(gl, images, textures) {
  images.forEach((image, i) => {
    gl.bindTexture(gl.TEXTURE_2D, textures[i]);
    let mipLevel = 0; // the largest mip
    let internalFormat = gl.RGBA; // format we want in the texture
    let srcFormat = gl.RGBA; // format of data we are supplying
    let srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
    gl.texImage2D(
      gl.TEXTURE_2D,
      mipLevel,
      internalFormat,
      srcFormat,
      srcType,
      image
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  });
  if (!$DEBUG) $proc_id = requestAnimationFrame($render);
}

function loadImage(url, callback) {
  let image = new Image();
  requestCORSIfNotSameOrigin(image, url);
  image.src = url;
  image.onload = callback;
  return image;
}

function loadImages(gl, urls) {
  let images = [];
  let textures = loadTexturesBlank(gl, urls);
  let imagesToLoad = urls.length;

  // Called each time an image finished loading.
  let onImageLoad = function() {
    --imagesToLoad;
    // If all the images are loaded call the callback.
    if (imagesToLoad === 0) {
      loadTextures(gl, images, textures);
    }
  };

  for (let i = 0; i < imagesToLoad; ++i) {
    let image = loadImage(urls[i], onImageLoad);
    images.push(image);
  }
}

// This is needed if the images are not on the same domain
// NOTE: The server providing the images must give CORS permissions
// in order to be able to use the image with WebGL. Most sites
// do NOT give permission.
// See: http://webgl2fundamentals.org/webgl/lessons/webgl-cors-permission.html
function requestCORSIfNotSameOrigin(img, url) {
  if (new URL(url).origin !== window.location.origin) {
    img.crossOrigin = "";
  }
}
