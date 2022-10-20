var audioArray=[];
setInterval("saveState()",5000);
var stopAudioTimeOut;

function saveState()
{
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        window.localStorage.setItem(id,document.getElementById(id).currentTime);
    }    
};

function getNextId(id){
    var i=audioArray.indexOf(id);
    if (i==audioArray.length-1){
        return audioArray[0];
    }
    else{
       return audioArray[i+1]; 
    }
};

function next(){
    var nextId=getNextId(this.id);
    document.getElementById(nextId).play();
}

function loadState(){
    var audios=document.getElementsByTagName("audio");
    for (var i = 0; i < audios.length; i++) {
        audios[i].addEventListener('ended',next,false);
        audioArray.push(audios[i].id);
    }
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        document.getElementById(id).currentTime=window.localStorage.getItem(id);
    }

};

function stopAudio(){
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        document.getElementById(id).pause();
    }
    document.getElementById("myselect").value=-1;
};

function timingChange(){
    window.clearTimeout(stopAudioTimeOut);
    var t=parseInt(this.value);
    if(t != -1){
        stopAudioTimeOut=window.setTimeout(stopAudio,t);
    }
};


$(
    function(){
        loadState();
        document.getElementById("myselect").onchange=timingChange;    
    }
);