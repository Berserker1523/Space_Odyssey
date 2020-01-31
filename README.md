# Space_Odyssey
Basic shot em' up. Consist in dodge asteroids that can increase their velocity with the time, obtaining better score.

## Mechanics and Procedures
* Movement:
	* With arrow keys in all directions
	* x for shot laser bullets
	* Couldn't pass screen borders

* Collisions (biggest headache)
	* Between space ship and asteroids
	* Between bullets and asteroids

* Textures (I am proud because I couldn't do it for the class exercise)

* Animations
	* When an asteroid collisions with another object, it is destroyed and displays an animation made with various textures changing every 0.1 second

* Draw with different programs and type of objects with VertexArrays
	* Used WebGL2.0
	* Program for visualize colliders with lines, and this program uses index vertices
	* Program for draw textured items

* Random asteroids generation that increase over time

* Velocity of asteroids that increase over time

* Background with stars running to the left: 2 bgs that exhange between them

* Pause system

* Audio system

* Life time system

* Object creatment decoupling	

* Render only if all textures where loaded

## Usage
* Open index.html and play
* For debug set $DEBUG=true in space-odyssey.js, that will show each element collider and console logs


## Technologies
* WebGl
* gl-matrix
