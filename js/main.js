var startRecordingUI = createClickFeedbackUI();

var video;
var takePhotoButton;
var toggleFullScreenButton;
var playButton;
var switchCameraButton;
var flashLightButton;
var amountOfCameras = 0;
var currentFacingMode = 'environment';
var mediaSource = new MediaSource();
var mediaRecorder;
var recordedBlobs;
var sourceBuffer;
var recording = 'false';
var playing = 'false';
var torchSupported = false;
var flashLightOn = false;

function deviceCount() {
  return new Promise(function (resolve) {
    var videoInCount = 0;

    navigator.mediaDevices
      .enumerateDevices()
      .then(function (devices) {
        devices.forEach(function (device) {
          if (device.kind === 'video') {
            device.kind = 'videoinput';
          }

          if (device.kind === 'videoinput') {
            videoInCount++;
            console.log('videocam: ' + device.label);
          }
        });

        resolve(videoInCount);
      })
      .catch(function (err) {
        console.log(err.name + ': ' + err.message);
        resolve(0);
      });
  });
}

document.addEventListener('DOMContentLoaded', function (event) {
  if (
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    navigator.mediaDevices.enumerateDevices
  ) {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: true,
      })
      .then(function (stream) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });

        deviceCount().then(function (deviceCount) {
          amountOfCameras = deviceCount;

          // init the UI and the camera stream
          initCameraUI();
          initCameraStream();
        });
      })
      .catch(function (error) {
        if (error === 'PermissionDeniedError') {
          alert('Camera permission denied. Please refresh and give permission.');
        }

        console.error('getUserMedia() error: ', error);
      });
  } else {
    alert(
      'The camera is not supported by the browser, or there is no camera detected/connected',
    );
  }
});

function initCameraUI() {
  video = document.getElementById('video');

  recordButton = document.getElementById('takeVideoBtn');
  toggleFullScreenButton = document.getElementById('fullScreenBtn');
  switchCameraButton = document.getElementById('switchCameraBtn');
  flashLightButton = document.getElementById('flashBtn');
  playButton = document.getElementById('playBtn');

  recordButton.addEventListener('click', () => {
    var recordIcon = recordButton.getElementsByTagName('svg')[0];
    var playIcon = playButton.getElementsByTagName('svg')[0];
    if (recording == 'false') {
      recording = 'true';
      startRecordingUI();
      startRecording();
      changeClass(recordIcon, 'fa-video', 'fa-stop');
      recordButton.classList.add('active');
    } else if (recording == 'true') {
      recording = 'done';
      stopRecording();
      startRecordingUI();
      playing = 'ready';
      recordButton.classList.remove('active');
      playButton.classList.remove('disabled');
      changeClass(recordIcon, 'fa-stop', 'fa-redo-alt');
    } else if (recording == 'done') {
      recording = 'false';
      playing = 'false';
      initCameraStream();
      playButton.classList.add('disabled');
      changeClass(recordIcon, 'fa-redo-alt', 'fa-video');
      changeClass(playIcon, 'fa-check', 'fa-play');
    }
  });

  playButton.addEventListener('click', () => {
    var playIcon = playButton.getElementsByTagName('svg')[0];
    if (playing == 'true') {
      alert('Recording Done');
    } else if(playing == 'ready') {
      playing = 'true';
      changeClass(playIcon, 'fa-play', 'fa-check');
      var superBuffer = new Blob(recordedBlobs, {
        type: 'video/webm',
      });
      video.src = null;
      video.srcObject = null;
      video.src = window.URL.createObjectURL(superBuffer);
      video.controls = false;
      video.play();
    }
  });

  flashLightButton.addEventListener('click', () => {
    if (torchSupported) {
      const track = window.stream.getVideoTracks()[0];
      if (flashLightOn) {
        track.applyConstraints({
            advanced: [{
              torch: false
            }]
          })
          .catch(e => console.log(e));
        flashLightOn = false;
      } else {
        track.applyConstraints({
            advanced: [{
              torch: true
            }]
          })
          .catch(e => console.log(e));
        flashLightOn = true;
      }
    }
  });

  // -- fullscreen part

  function fullScreenChange() {

    var toggleIcon = toggleFullScreenButton.getElementsByTagName('svg')[0];

    if (screenfull.isFullscreen) {
      changeClass(toggleIcon, 'fa-arrows-alt', 'fa-compress-arrows-alt');
    } else {
      changeClass(toggleIcon, 'fa-compress-arrows-alt', 'fa-arrows-alt');
    }
  }

  if (screenfull.isEnabled) {
    screenfull.on('change', fullScreenChange);

    // set init values
    fullScreenChange();

    toggleFullScreenButton.addEventListener('click', function () {
      screenfull.toggle(document.getElementById('container')).then(function () {
        console.log(
          'Fullscreen mode: ' +
          (screenfull.isFullscreen ? 'enabled' : 'disabled'),
        );
      });
    });
  } else {
    console.log("iOS doesn't support fullscreen (yet)");
  }

  // -- switch camera part
  if (amountOfCameras > 1) {
    switchCameraButton.classList.remove('disabled');

    switchCameraButton.addEventListener('click', function () {
      if (currentFacingMode === 'environment') currentFacingMode = 'user';
      else currentFacingMode = 'environment';

      initCameraStream();
    });
  }

  window.addEventListener(
    'orientationchange',
    function () {
      if (screen.orientation) angle = screen.orientation.angle;
      else angle = window.orientation;

      var guiControls = document.getElementById('gui_controls').classList;
      var vidContainer = document.getElementById('vid_container').classList;

      if (angle == 270 || angle == -90) {
        guiControls.add('left');
        vidContainer.add('left');
      } else {
        if (guiControls.contains('left')) guiControls.remove('left');
        if (vidContainer.contains('left')) vidContainer.remove('left');
      }
    },
    false,
  );
}

function initCameraStream() {
  if (window.stream) {
    window.stream.getTracks().forEach(function (track) {
      //console.log(track);
      track.stop();
    });
  }

  var size = 1280;

  var constraints = {
    audio: false,
    video: {
      // width: {
      //   ideal: size
      // },
      // height: {
      //   ideal: size
      // },
      width: { min: 176, ideal: 1280, max: 1920 },
      height: { min: 144, ideal: 720, max: 1080 },
      facingMode: currentFacingMode,
    },
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(handleSuccess)
    .catch(handleError);

  function handleSuccess(stream) {
    window.stream = stream; // make stream available to browser console
    video.srcObject = stream;

    const track = window.stream.getVideoTracks()[0];
    const settings = track.getSettings();
    str = JSON.stringify(settings, null, 4);

    window.setTimeout(() => {
      if (track.getCapabilities().torch) {
        torchSupported = true;
        flashLightButton.classList.remove('disabled');
      } else {
        torchSupported = false;
        flashLightButton.classList.add('disabled');
      }
    }, 500);
    //console.log('settings ' + str);
  }

  function handleError(error) {
    console.error('getUserMedia() error: ', error);
  }
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function startRecording() {
  recordedBlobs = [];
  var options = {
    mimeType: 'video/webm;codecs=vp9',
  };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    options = {
      mimeType: 'video/webm;codecs=vp8',
    };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not Supported`);
      options = {
        mimeType: 'video/webm',
      };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        options = {
          mimeType: '',
        };
      }
    }
  }

  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    return;
  }
  // mediaRecorder.onstop = (event) => {
  //   console.log('Recorder stopped: ', event);
  // };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(); // collect 10ms of data
}

function stopRecording() {
  mediaRecorder.stop();
}

function createClickFeedbackUI() {
  var overlay = document.getElementById('video_overlay');

  var sndClick = new Howl({
    src: ['snd/click.mp3']
  });

  var overlayVisibility = false;
  var timeOut = 50;

  function setFalseAgain() {
    overlayVisibility = false;
    overlay.style.display = 'none';
  }

  return function () {
    if (overlayVisibility == false) {
      sndClick.play();
      overlayVisibility = true;
      overlay.style.display = 'block';
      setTimeout(setFalseAgain, timeOut);
    }
  };
}

function changeClass(elem, cl1, cl2) {
  elem.classList.remove(cl1);
  elem.classList.add(cl2);
}