/* eslint-disable */
require('qcobjects');logger.infoEnabled=false;
        Class('MyTestService',Service,{
            name:'myservice',
            external:true,
            cached:false,
            method:"POST",
            
            url:"https://postman-echo.com/post",
            withCredentials:false,
            _new_:()=>{
                // service instantiated
            },
            done:()=>{
                // service loaded
            }
        });
    var service = serviceLoader(New(MyTestService,{
          data:""
    })).then(
      (successfulResponse)=>{
            // This will show the service response as a plain text
            console.log(successfulResponse.service.template);
    },
    (failedResponse)=>{
              // The service call failed
              console.log('The service call failed');
              console.log(failedResponse);
    }).catch((e)=>{
              // Something went wrong when calling the service
              console.log('Something went wrong when calling the service');
              console.log(failedResponse);
    });