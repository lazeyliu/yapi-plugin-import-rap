import './style.scss';
import axios from 'axios'
import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Input, message } from 'antd';
const Search = Input.Search;
@connect(state => {
  return {
    uid: state.user.uid + '',
    curdata: state.inter.curdata,
    currProject: state.project.currProject
  }
})
class ImportRap extends Component {
  constructor(props) {
    super(props);
  }
  static propTypes = {
    match: PropTypes.object,
    projectId: PropTypes.string
  };

  formatDeep(key,scope,parentId) {
    let res_body = {
      properties: {},
      required: [],
      title: "empty object",
      type: "object"
    }
    key.forEach(rp => {
      if (rp.scope === scope && rp.parentId === parentId) {
        let identifier = rp.name;
        res_body.required.push(identifier);
        
        let mock = rp.rule ? rp.rule.replace('@mock=','').replace(/[\'\"]/g,'') : ''
        let rule
        if(rp.type=='number'){
          if(mock && mock.indexOf('+') > -1) {
            rule = `@increment(${mock.replace('+','')})`
          } else if(mock && mock.indexOf('.') > -1) {
            rule = '@float(1, 999999, 1, 10)'
          } else{
            rule = mock ? mock : '@integer(1, 999999)'
          }
        } else {
          rule = mock
        }
        
        let ps = {
          description: rp.description,
          mock: rule ? { mock: rule } : rp.value ? { mock: rp.vaule } : undefined,
          type: rp.type.toLowerCase(),
        }

        let child = this.formatDeep(key,scope,rp.id);
        if (child && child.required.length > 0) res_body.properties[identifier] = child;
        else res_body.properties[identifier] = ps;
      }
    })
    return res_body
  }

  addInterface(interfaces, catid){
    interfaces.forEach(j=>{
      let fName = j.name || j.id;
      if(j.url){        
        let rm = j.method;
        let url = `/${j.id}`;
        if (j.url[0] == '/') url = j.url;
        else if (j.url.startsWith('http://'))  url = j.url.substr(j.url.indexOf('/',7));
        else if (j.url.startsWith('https://')) url = j.url.substr(j.url.indexOf('/',8));
        else url = `/${j.url}`;
        
        let createParams = {
          catid,
          method: rm,
          path: url,
          project_id: this.props.match.params.id,
          title: `${fName}`,
          desc: j.description
        }
        axios.post('/api/interface/add',createParams).then(res3 => {
          if(res3.data.errcode !== 0){
            message.error(`插入${fName}失败: ${res3.data.errmsg}`);
            console.error(`插入${fName}失败: ${res3.data.errmsg}`);
            return false
          }
          let interface_id = res3.data.data._id
          let req_query = []
          let req_body_other = {
            properties: {},
            required: [],
            title: "empty object",
            type: "object"
          }
          if(rm === 'GET') {
            j.properties.forEach( rp => {
              req_query.push({
                desc: rp.name,
                example: rp.remark.replace('@mock=','').replace(/[\'\"]/g,''),
                name: rp.identifier,
                required: "1"
              })
            })
          } else {
            req_body_other = this.formatDeep(j.properties,'request',-1)
            console.log('req_body_other=>', req_body_other);            
          }
          let res_body = this.formatDeep(j.properties,'response',-1)
          console.log('res_body=>', res_body);

          let upparams = Object.assign({
            api_opened: false,
            catid: '',
            desc: '',
            id: interface_id,
            markdown: '',
            method: '',
            path: '',
            req_body_form: [],
            req_body_is_json_schema: true,
            req_body_other: rm === 'GET' ? undefined : JSON.stringify(req_body_other),
            req_body_type: rm === 'GET' ? undefined : 'json',
            req_headers: rm === 'GET' ? [] : [{name: "Content-Type", value: "application/json"}],
            req_params: [],
            req_query: rm === 'GET' ? req_query : undefined,
            res_body: JSON.stringify(res_body),
            res_body_is_json_schema: true,
            res_body_type: 'json',
            status: 'done',
            switch_notice: true,
            tag: [],
            title: ''
          }, createParams)
          delete upparams.project_id
          axios.post('/api/interface/up', upparams).then(upres => {
            if(upres.data.errcode === 0){
              message.success(`插入接口${fName}成功`);
            } else {
              message.error(`插入接口${fName}失败: ${upres.data.errmsg}`)
              console.error(`插入接口${fName}失败: ${upres.data.errmsg}`)
            }
          })
        })
      }
    })
  }

  importFromRap = async(id) => {
    // let r = await this.props.fetchInterfaceListMenu(this.props.match.params.id);
    // console.log(r)
    let project_id = this.props.match.params.id
    const res = await axios.get('/api/plugin/rap/get?id='+id+'&project_id='+project_id)
    if(res.data.errcode === 0){
      message.success(`远程获取RAP数据成功`);
      console.log('rap数据=>', res.data.data)
    } else {
      message.error(res.data.errmsg||'[请检查projectID是否存在]')
      return false
    }
    
    res.data.data.modules.forEach( e=> {
      let moduleName = (e.name == '' || e.name=='某模块（点击编辑后双击修改）') ? res.data.data.name : e.name
      console.log(moduleName)
      axios.post('/api/interface/add_cat', {
        desc: moduleName,
        name: moduleName,
        project_id
      }).then(res2 => {
        if(res2.data.errcode === 0){
          message.success(`新增接口分类[${moduleName}]成功`);
          let catid = res2.data.data._id
          this.addInterface(e.interfaces, catid)
        } else {
          message.error(res2.data.errmsg)
        }
        
      })
      
    })
  }

  render() {
    return (
      <div className="g-row">
        <section className="news-box m-panel">
          <div className="Mockurl">
            <span>Rap项目id：</span>
            <Search
              placeholder="Rap project id"
              enterButton="执行导入"
              size="large"
              onSearch={id => this.importFromRap(id)}
              />
          </div>
          <div className="rap-help">
            <h3>* Project Id：</h3>
            <p>在RAP中点入项目之后，查看浏览器地址栏中的“projectId=”</p>
            <br />
            <h3>* 导入的文件夹：</h3>
            <p>
              导入之后以接口的模块建立文件夹，即RAP进入项目后内容区域右上角的Tab
            </p>
            <br />
            <h3>* 接口名称前缀：</h3>
            <p>如果RAP项目中接口列表有分多个group，则在接口名称前面添加group名称</p>
          </div>
        </section>
      </div>
    );
  }
}

export default ImportRap;
