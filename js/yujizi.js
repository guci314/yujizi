var audioArray=[];
setInterval("saveState()",10000);
var stopAudioTimeOut;
var theTime;

function reset(){
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        var a=document.getElementById(id);
        a.currentTime=0;
    }
    saveState()
    alert("已复位")
};

function back30sec(){
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        var a=document.getElementById(id);
        if (a.currentTime>0 && !a.paused && !a.ended && a.readyState>2){
            a.currentTime=a.currentTime-30
        }
    }
};

function saveState()
{
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        var a=document.getElementById(id);
        window.localStorage.setItem(id,a.currentTime);
        // if (a.currentTime>0 && !a.paused && !a.ended && a.readyState>2){
        //     window.localStorage.setItem("lastPlayId",a.id);
        // }
    }    
    if (theTime){
        var d=new Date();
        var x=theTime-d;//Math.floor((theTime-d)/60000)
        if (x<0) x=0;
        if (x>=0){
            var min=Math.floor(x/60000);
            var sec=Math.floor((x-min*60000)/1000);
            document.getElementById("remainTime").innerText=min+"分钟"+sec+"秒";
        }
    };
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
    };
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        document.getElementById(id).currentTime=window.localStorage.getItem(id);
    };
    // lastId=window.localStorage.getItem("lastPlayId");
    // if (lastId){
    //     document.getElementById(lastId).preload="auto";
    // }
    // if (lastId){
    //     document.getElementById(lastId).play();
    // }
};

function stopAudio(){
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        document.getElementById(id).pause();
    }
    document.getElementById("myselect").value=-1;
};

Date.dateAdd = function(currentDate, value, timeUnit) {

    timeUnit = timeUnit.toLowerCase();
    var multiplyBy = { w:604800000,
                     d:86400000,
                     h:3600000,
                     m:60000,
                     s:1000 };
    var updatedDate = new Date(currentDate.getTime() + multiplyBy[timeUnit] * value);

    return updatedDate;
};

function timingChange(){
    window.clearTimeout(stopAudioTimeOut);
    var t=parseInt(this.value);
    if(t != -1){
        stopAudioTimeOut=window.setTimeout(stopAudio,t);
        var d=new Date();
        theTime=Date.dateAdd(d,t/1000,"s");
    }
};


$(
    function(){
        loadState();
        document.getElementById("myselect").onchange=timingChange;    
    }
);