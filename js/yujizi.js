var audioArray=[];
setInterval("saveState()",5000);

function saveState()
{
    // var d = new Date();
    // d.setTime(d.getTime() + (10 * 24 * 60 * 60 * 1000));
    // var expires = "expires="+d.toUTCString();
    for ( var i=0;i<audioArray.length;i++ ) {
        var id=audioArray[i];
        // document.cookie=id+"="+document.getElementById(id).currentTime+ ";"+expires + ";domain=" + window.location.hostname+';path=/';
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
        // document.cookie=id+"="+document.getElementById(id).currentTime+ ";"+expires + ";domain=" + window.location.hostname+';path=/';
        document.getElementById(id).currentTime=window.localStorage.getItem(id);
    }
    // var ca = document.cookie.split(';');
    // for(var i=0; i<ca.length; i++) 
    // {
    //     var c = ca[i].trim();
    //     var x=c.split("=");
    //     var name=x[0];
    //     var value=x[1];
    //     //$("#test").append(name+"="+value+"   ");
    //     audio=document.getElementById(name);
    //     if (audio){
    //         audio.currentTime=value;
    //     };
    // };

};


$(
    function(){
        loadState();    
    }
);