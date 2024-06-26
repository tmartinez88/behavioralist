/*
 * @name Flocking
 * @arialabel Light grey circles on a dark grey background that travel across the screen in flocks or groups
 * @description Demonstration of <a href="http://www.red3d.com/cwr/">Craig Reynolds' "Flocking" behavior</a>.<br>
 * (Rules: Cohesion, Separation, Alignment.)<br>
 * From <a href="http://natureofcode.com">natureofcode.com</a>.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
let boids = [];

let playing = false;
let button;
let index = 0;
let index2 = 0;
let amp = 0;
let pan = 0;
let counter = 0;
let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

const startup = async () => {
    let rawPatcher = await fetch("imsys2.export.json");
    let patcher = await rawPatcher.json();
    let device = await RNBO.createDevice({ context, patcher });
    
    let rawPatcher2 = await fetch("rnbo.platereverb.json");
    let patcher2 = await rawPatcher2.json();
    let verbDevice = await RNBO.createDevice({ context, patcher: patcher2 });
    
    let dependencies = await fetch("dependencies.json");
    dependencies = await dependencies.json();

    // Load the dependencies into the device
    const results = await device.loadDataBufferDependencies(dependencies);
    results.forEach(result => {
        if (result.type === "success") {
            //console.log(`Successfully loaded buffer with id ${result.id}`);
            button.html('play');
            button.mousePressed(soundy);
        } else {
            //console.log(`Failed to load buffer with id ${result.id}, ${result.error}`);
        }
    });
    index = device.parametersById.get("index");
    index2 = device.parametersById.get("index2");
    amp = device.parametersById.get("amp");
    pan = device.parametersById.get("pan");
    device.node.connect(verbDevice.node);
    verbDevice.node.connect(context.destination);
    context.suspend();
};

// We can't await an asynchronous function at the top level, so we create an asynchronous
// function setup, and then call it without waiting for the result.
startup();

function soundy() {
  if (!playing) {
    playing = true;
    context.resume();
    button.html("stop");
  }
  else {
    playing = false;
    context.suspend();
    button.html("play");
  }
}

function setup() {
  let cnv = createCanvas(400, 400);
  button = createButton('loading');
  button.parent('main');
  button.position(170, 450);
  cnv.parent('main');
  cnv.style('display', 'block');
  frameRate(30);
  // Add an initial set of boids into the system
  for (let i = 0; i < 130; i++) {
    boids[i] = new Boid(random(width), random(height));
  }
  
}

function draw() {
  background(0);
  counter += 1;
  for (let i = 0; i < boids.length; i++) {
    boids[i].run(boids);
    if(counter % 6 == 0) {
      try {
      index.value = i;
      index2.value = i;
      pan.value = map(boids[i].position.x, 0, width, 1, 0);
      amp.value = map(boids[i].position.y, 0, height, 1.1, 0.08);
      }
      catch (error) {
        //console.log(error);
      }
    } 
  }
  
}

// Boid class
// Methods for Separation, Cohesion, Alignment added
class Boid {
  constructor(x, y) {
    this.acceleration = createVector(0, 0);
    this.velocity = p5.Vector.random2D();
    this.position = createVector(x, y);
    this.r = 7.0;
    this.maxspeed = 20;    // Maximum speed
    this.maxforce = 1.777; // Maximum steering force
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.borders();
    this.render();
  }
  
  // Forces go into acceleration
  applyForce(force) {
    this.acceleration.add(force);
  }
  
  // We accumulate a new acceleration each time based on three rules
  flock(boids) {
    let sep = this.separate(boids); // Separation
    let ali = this.align(boids);    // Alignment
    let coh = this.cohesion(boids); // Cohesion
    let gol = this.goal(); //Goal Position
    // Arbitrarily weight these forces
    sep.mult(map(clamp(mouseX, 0, width), 0.0, width, 0.6, 2.6));
    ali.mult(2.5);
    coh.mult(map(clamp(mouseY, 0, height), 0.0, height, 2.1, 1.6));
    gol.mult(1.4);
    // Add the force vectors to acceleration
    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
    this.applyForce(gol);
    
    //this.maxspeed = map(clamp(mouseX, 0, width), 0.0, width, 4, 7);

    //this.maxforce = map(clamp(mouseY, 0, height), 0.0, height, 0.4, 5);
    
  }
  
  // Method to update location
  update() {
    
    // Update velocity
    this.velocity.add(this.acceleration);
    // Limit speed
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    // Reset acceleration to 0 each cycle
    this.acceleration.mult(0);
  }
  
  // A method that calculates and applies a steering force towards a target
  // STEER = DESIRED MINUS VELOCITY
  seek(target) {
    let desired = p5.Vector.sub(target, this.position); // A vector pointing from the location to the target
    // Normalize desired and scale to maximum speed
    desired.normalize();
    desired.mult(this.maxspeed);
    // Steering = Desired minus Velocity
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxforce); // Limit to maximum steering force
    return steer;
  }
  
  // Draw boid as a circle
  render() {
    fill(255, 0, 0);
    stroke(0, 0, 0);
    ellipse(this.position.x, this.position.y, this.r, this.r);
  }
  
  // BOUNCE OFF WALLS
  borders() {
    if (this.position.x < (0 + this.r) || this.position.x > (width - this.r)) {
      this.velocity.x = this.velocity.x * -1;
    }
    if (this.position.y < (0 + this.r)|| this.position.y > (height - this.r)) {
      this.velocity.y = this.velocity.y * -1;}
  }
  
  // Separation
  // Method checks for nearby boids and steers away
  separate(boids) {
    let desiredseparation = 50.0;
    let steer = createVector(0, 0);
    let count = 0;
    // For every boid in the system, check if it's too close
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      // If the distance is greater than 0 and less than an arbitrary amount (0 when you are yourself)
      if ((d > 0) && (d < desiredseparation)) {
        // Calculate vector pointing away from neighbor
        let diff = p5.Vector.sub(this.position, boids[i].position);
        diff.normalize();
        diff.div(d); // Weight by distance
        steer.add(diff);
        count++; // Keep track of how many
      }
    }
    // Average -- divide by how many
    if (count > 0) {
      steer.div(count);
    }
  
    // As long as the vector is greater than 0
    if (steer.mag() > 0) {
      // Implement Reynolds: Steering = Desired - Velocity
      steer.normalize();
      steer.mult(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce);
    }
    return steer;
  }
  
  // Alignment
  // For every nearby boid in the system, calculate the average velocity
  align(boids) {
    let neighbordist = 100;
    let sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if ((d > 0) && (d < neighbordist)) {
        sum.add(boids[i].velocity);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxspeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxforce);
      return steer;
    } else {
      return createVector(0, 0);
    }
  }
  
  // Cohesion
  // For the average location (i.e. center) of all nearby boids, calculate steering vector towards that location
  cohesion(boids) {
    let neighbordist = 1000;
    let sum = createVector(0, 0); // Start with empty vector to accumulate all locations
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if ((d > 0) && (d < neighbordist)) {
        sum.add(boids[i].position); // Add location
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this.seek(sum); // Steer towards the location
    } else {
      return createVector(0, 0);
    }
  }  
  goal() {
    //let golPos = createVector(clamp(mouseX, 0, width), clamp(mouseY, 0, height));
    let golPos = createVector(map(clamp(mouseX, 0, width), 0, width, -1, 1), map(clamp(mouseY, 0, height), 0, height, -1, 1));
    //console.log(golPos);
    let steer = p5.Vector.sub(golPos, this.velocity);
    steer.limit(this.maxforce);
    return steer;
  }
}

