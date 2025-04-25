import React from 'react';
import {observer, inject} from 'mobx-react';
import CodeMirror from 'react-codemirror';

@inject('dataStore')
@observer
export default class Nodejs extends React.Component {

    constructor(props) {
        super(props);
        this.dataStore = this.props.dataStore;
    }

    render() {
        let options = {
            lineNumbers: true,
        };
        let code = `var leo = require("leo-sdk")({\n\tkinesis: "${this.dataStore.sdkConfig.kinesis}",\n\tfirehose: "${this.dataStore.sdkConfig.firehose}",\n\ts3: "${this.dataStore.sdkConfig.s3}",\n\tregion: "${this.dataStore.sdkConfig.region}"\n});`

        return (
            !code
                ? <div className="theme-spinner-large" />
                : (
                    <div>
                        <h1>NodeJS SDK</h1>
                        <div style={{width: '1000px'}}>
                            <CodeMirror value={code} options={options} />
                        </div>
                    </div>
                )
        )

    }
}