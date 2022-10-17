
setInterval("saveState()",5000);

function saveState()
{
    var audios=document.getElementsByTagName("audio")
    for ( var i=0;i<audios.length;i++ ) {
        var id=audios[i].getAttribute("id");
        //alert(id);
        Cookies.set(id,document.getElementById(id).currentTime);
        //document.cookie=id+"="+document.getElementById(id).currentTime;
        //$("#test").append(id+"="+document.getElementById(id).currentTime+"   ");
    }    
};

function loadState(){
    //var x=Cookies.get();
    //alert(x)
    //$("#test").append(document.cookie);
    //$("#test").append("------");
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) 
    {
        var c = ca[i].trim();
        var x=c.split("=");
        var name=x[0];
        var value=x[1];
        //$("#test").append(name+"="+value+"   ");
        //if (name.indexOf("audio")==0){
        audio=document.getElementById(name);
        if (audio){
            audio.currentTime=value;
        };
        //}
    }
}

$(
    function(){
        loadState();    
    }
);