/*
	Jake's Visualizer 2015 - MIT license.

	http://www.airtightinteractive.com/2013/10/making-audio-reactive-visuals/

*/

function Vis(){
	this.source = null;
	this.bufferLength = null;
	this.dataArray = null;

	this.debug = document.querySelector('.debug');

	this.canvas = document.querySelector('.visualizer');

	this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
	this.analyser = this.audioContext.createAnalyser();

	this.playBtn = document.querySelector('.play');
	this.playBtn.onclick = this.startBtnClicked.bind(this);

	this.stopBtn = document.querySelector('.stop');
	this.stopBtn.onclick = this.stopBtnClicked.bind(this);

	this.versionText = document.querySelector('.version');
	this.versionText.innerHTML = "("+buildInfo+")";

	this.dataLoaded = 0;
	this.drawInitalized = 0;

	this.frameCounter = 0;

	this.dataTrail = [];

	this.halfPi = Math.PI/2;
	this.quarterPi = Math.PI/4;
}

Vis.prototype.startBtnClicked = function(){
	this.loadSong();
	this.initVisualizer();
	this.source.start(0);
	this.playBtn.setAttribute('disabled', 'disabled');
};

Vis.prototype.stopBtnClicked = function(){
	this.source.stop(0);
	this.source.disconnect(this.audioContext.destination);
	this.source.disconnect(this.analyser);
	this.playBtn.removeAttribute('disabled');
};

Vis.prototype.loadSong = function(){
	this.stopBtn.setAttribute('disabled', 'disabled');
	this.source = this.audioContext.createBufferSource();
	var request = new XMLHttpRequest();
	request.open('GET', 'music/3LAU x Galantis - How You Love U & I (3LAU Mashup).mp3', true);
	request.responseType = 'arraybuffer';
	request.onload = this.songLoaded.bind(this,request);
	request.send();
};

Vis.prototype.songLoaded = function(request){
	var audioData = request.response;
	this.audioContext.decodeAudioData(
		audioData,
		this.decodeAudioData.bind(this),
		function(e){alert("Error with decoding audio data" + e.err);}
	);
};

Vis.prototype.decodeAudioData = function(buffer){
	this.stopBtn.removeAttribute('disabled');
	this.source.buffer = buffer;
	this.source.connect(this.audioContext.destination);
	this.source.loop = true;
};

Vis.prototype.initVisualizer = function(){
	this.source.connect(this.analyser);
	this.analyser.fftSize = 128; //must be power of 2
	//this.analyser.smoothingTimeConstant = 1;
	this.bufferLength = this.analyser.fftSize;
	this.dataArray = new Uint8Array(this.bufferLength);

	this.circleSlice = (Math.PI*2) / this.bufferLength;

	this.trigCount = 0;

	this.initThreeJs();

	if(this.drawInitalized === 0){
		this.drawInitalized = 1;
		window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
		this.draw();
	}

};

Vis.prototype.initThreeJs = function(){
	this.renderer = new THREE.WebGLRenderer({canvas: this.canvas});
	this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize( window.innerWidth, window.innerHeight);
	this.renderer.setClearColor( 0xffffff );

	this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
	this.camera.position.z = 400;

	this.scene = new THREE.Scene();
	this.scene.fog = new THREE.Fog( 0x000000, 1, 1000 );

	this.object = new THREE.Object3D();
	this.scene.add( this.object );

	var geometry = new THREE.SphereGeometry( 1, 10, 10 );
	var material = new THREE.MeshPhongMaterial( { color: 0xffffff, shading: THREE.FlatShading } );

	for ( var i = 0; i < this.bufferLength; i ++ ) {

		var mesh = new THREE.Mesh( geometry, material );
		mesh.position.set(0,0,0).normalize();
		mesh.position.multiplyScalar(10);
		mesh.rotation.set(0,0,0);
		mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;
		this.object.add( mesh );

	}

	this.scene.add( new THREE.AmbientLight( 0x222222 ) );

	this.light = new THREE.DirectionalLight( 0xffffff );
	this.light.position.set( 1, 1, 1 );
	this.scene.add( this.light );

	// postprocessing
	
	this.composer = new THREE.EffectComposer( this.renderer );
	this.composer.addPass( new THREE.RenderPass( this.scene, this.camera ) );

	this.dotEffect = new THREE.ShaderPass( THREE.DotScreenShader );
	this.dotEffect.uniforms.scale.value = 4;
	this.composer.addPass( this.dotEffect );

	this.rgbEffect = new THREE.ShaderPass( THREE.RGBShiftShader );
	this.rgbEffect.uniforms.amount.value = 0.0015;
	this.rgbEffect.renderToScreen = true;
	this.composer.addPass( this.rgbEffect );
	
};

Vis.prototype.onWindowResize = function(){
	this.camera.aspect = window.innerWidth / window.innerHeight;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize( window.innerWidth, window.innerHeight );
};

Vis.prototype.draw = function(){

	this.trigCount += Math.PI /160;
	this.trigCount = this.trigCount % (Math.PI*2);
	

	this.analyser.getByteTimeDomainData(this.dataArray);


	var average = 0;
	for(var a = 0,al = this.dataArray.length;a<al;a++){
		average+=Math.abs(this.dataArray[0]-128);
	}
	average /= this.dataArray.length;

	
	this.dataTrail.unshift(average);
	if(this.dataTrail.length>this.bufferLength){
		this.dataTrail.pop();
	}

	this.rgbEffect.uniforms.amount.value = (average/128)*0.0080+0.0015;

	for(var i = 0,il = this.dataArray.length;i < il ; i++) {
		//console.log(this.dataTrail);

		//this.debug.innerHTML = this.dataTrail[i];

		this.dataArray[i] = Math.abs(this.dataArray[i]-128);

		var x = Math.cos(this.halfPi+this.circleSlice*i)*(this.dataArray[i]+100+((average/128)*100));
		var y = Math.sin(this.halfPi+this.circleSlice*i)*(this.dataArray[i]+100+((average/128)*100));

		var child = this.object.children[i];

		child.position.set(x,y,0);
		child.scale.x = child.scale.y = child.scale.z = (this.dataTrail[i]/128)*10+((average/128)*3)+5;
	}
	
	//this.object.rotation.x += 0.03;
	//this.object.rotation.y += 0.05;

	//this.renderer.render( this.scene, this.camera );
	this.composer.render();


	/*
	//this.canvasContext.fillStyle = 'rgba(0,0,0,0.05)';
	this.canvasContext.fillStyle = 'rgba(0,0,0,0.1)';
	this.canvasContext.fillRect(0, 0, this.canvas.width,  this.canvas.height);

	//var tempcanvas = this.canvasContext;
	//var fadeIntoBackSpeed = 5;
	//this.canvasContext.drawImage(tempcanvas.canvas,fadeIntoBackSpeed/2,fadeIntoBackSpeed/2,this.canvas.width-fadeIntoBackSpeed,this.canvas.height-fadeIntoBackSpeed);


	var average = this.dataArray[0];
	//for(var i =0,il=10;i<il;i++){
		//average+=this.dataArray[i];
	//}
	//average = average/10;

	
	this.dataTrail.unshift(average);
	if(this.dataTrail.length>this.bufferLength){
		this.dataTrail.pop();
	}	


	this.canvasContext.strokeStyle = 'rgb(255,255,255)';
	this.canvasContext.lineWidth = 10;
	
	this.canvasContext.beginPath();

	for(var i = 0,il = this.dataTrail.length;i < il ; i++) {
		//console.log(this.dataTrail);
		//this.debug.innerHTML = this.dataTrail[i];

		var x = Math.cos(this.halfPi+this.circleSlice*i)*(this.dataTrail[i])+(this.canvas.width/2)+200*Math.cos(this.trigCount);
		var y = Math.sin(this.halfPi+this.circleSlice*i)*(this.dataTrail[i])+(this.canvas.height/2)+200*Math.sin(this.trigCount*2);

		if(i === 0) {
			this.canvasContext.moveTo(x, y);
		} else {
			this.canvasContext.lineTo(x, y);
		}

	}
	//this.canvasContext.lineTo(this.canvas.width, this.canvas.height/2);
	this.canvasContext.stroke();
	*/

	/*
	var binWidth = (this.canvas.width / this.bufferLength);
	var value;

	var sample = new Uint8Array(this.bufferLength); // should only need one sample
	this.analyser.getByteTimeDomainData(sample);
	// Draw rectangle for each vocoder bin.
	for (var i = 0; i < this.bufferLength; i++) {
	this.canvasContext.fillStyle = "hsl( " + Math.round((i*360)/this.bufferLength) + ", 100%, 50%)";

	value = ((1.0 * sample[i]) - 128.0) / 64;
	this.canvasContext.fillRect(i * binWidth, this.canvas.height, binWidth, -value * this.canvas.height );
	}*/

	/*
	var barWidth =(this.canvas.width / this.bufferLength);
	var x =0;
	for(var i = 0; i < this.bufferLength; i++) {
		var barHeight = this.dataArray[i];

		this.canvasContext.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
		this.canvasContext.fillRect(x,this.canvas.height-barHeight/2,barWidth,barHeight);

		x += barWidth + 1;
	}
	*/

	requestAnimationFrame(this.draw.bind(this));
};

/*
Random code at the bottom of the barrel

function smoothMove(from,to){
	var temp;
	if(from<to)
	temp=(from+(0.1*Math.abs(from-to)));
	else
	temp=(from-(0.1*Math.abs(from-to)));
	return Math.ceil(temp);
}



var size = 0;
var goalSize = 0;
var boxX = 0;
var boxY = 0;
var sinCounter = 0;


function drawCenteredSquare(ctx,x,y,width,height){
	ctx.rect(x-width/2,y-height/2,width,height);
}
*/